import { getEmailConfig } from "@/lib/email/config";
import { eventUrl, paymentActionUrl, qrImageUrl } from "@/lib/email/links";
import { sendEmail } from "@/lib/email/send";
import {
  eventSummaryEmail,
  paymentReceivedEmail,
  paymentRequestEmail,
  type CompanyTotals,
} from "@/lib/email/templates";
import {
  normalizeSettlementSummary,
  type SettlementSummary,
  type SettlementTransfer,
} from "@/lib/settlement";
import { createServiceClient } from "@/lib/supabase/admin";
import type { EmailNotificationKind } from "@/lib/types/database";

/** Interval mezi připomínkami; tolerance kryje drift cronu. */
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REMINDER_TOLERANCE_MS = 60 * 60 * 1000;

type Recipient = {
  id: string;
  name: string;
  email: string | null;
  iban: string | null;
};

type EventContext = {
  eventId: string;
  eventName: string;
  companyId: string;
  companyName: string;
  notifyEmails: boolean;
  summary: SettlementSummary;
  closedAt: string;
  recipients: Map<string, Recipient>;
};

export type NotifyResult = {
  sent: number;
  skipped: number;
  failed: number;
};

const EMPTY_RESULT: NotifyResult = { sent: 0, skipped: 0, failed: 0 };

function mergeResults(...results: NotifyResult[]): NotifyResult {
  return results.reduce(
    (acc, r) => ({
      sent: acc.sent + r.sent,
      skipped: acc.skipped + r.skipped,
      failed: acc.failed + r.failed,
    }),
    { ...EMPTY_RESULT }
  );
}

export function paymentMessageFor(
  companyName: string,
  eventName: string
): string {
  return `Splitnito - ${companyName} - ${eventName}`;
}

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

async function loadEventContext(
  admin: Admin,
  eventId: string
): Promise<EventContext | null> {
  const { data: event } = await admin
    .from("events")
    .select("id, name, status, company_id, notify_emails")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.status !== "closed") return null;

  const [{ data: settlement }, { data: company }, { data: profiles }] =
    await Promise.all([
      admin
        .from("settlements")
        .select("summary_data, closed_at")
        .eq("event_id", eventId)
        .maybeSingle(),
      admin
        .from("companies")
        .select("name")
        .eq("id", event.company_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id, name, email, iban")
        .eq("company_id", event.company_id),
    ]);

  if (!settlement?.summary_data) return null;

  return {
    eventId: event.id,
    eventName: event.name,
    companyId: event.company_id,
    companyName: company?.name ?? "firma",
    notifyEmails: event.notify_emails !== false,
    summary: normalizeSettlementSummary(settlement.summary_data),
    closedAt: settlement.closed_at,
    recipients: new Map(
      (profiles ?? []).map((p) => [
        p.id,
        { id: p.id, name: p.name, email: p.email, iban: p.iban },
      ])
    ),
  };
}

async function logNotification(
  admin: Admin,
  entry: {
    eventId: string | null;
    companyId: string | null;
    kind: EmailNotificationKind;
    transferId?: string | null;
    recipientId?: string | null;
    recipientEmail: string;
    status: "sent" | "failed";
    error?: string | null;
    reminderIndex?: number;
  }
): Promise<void> {
  await admin.from("email_notifications").insert({
    event_id: entry.eventId,
    company_id: entry.companyId,
    kind: entry.kind,
    transfer_id: entry.transferId ?? null,
    recipient_id: entry.recipientId ?? null,
    recipient_email: entry.recipientEmail,
    status: entry.status,
    error: entry.error ?? null,
    reminder_index: entry.reminderIndex ?? 0,
  });
}

/** Kolikrát a kdy naposledy jsme danou notifikaci úspěšně poslali. */
async function notificationHistory(
  admin: Admin,
  params: {
    eventId: string;
    kind: EmailNotificationKind;
    transferId?: string | null;
    recipientId?: string | null;
  }
): Promise<{ count: number; lastSentAt: number | null }> {
  let query = admin
    .from("email_notifications")
    .select("created_at")
    .eq("event_id", params.eventId)
    .eq("kind", params.kind)
    .eq("status", "sent")
    .order("created_at", { ascending: false });

  if (params.transferId) query = query.eq("transfer_id", params.transferId);
  if (params.recipientId) query = query.eq("recipient_id", params.recipientId);

  const { data } = await query;
  const rows = data ?? [];
  return {
    count: rows.length,
    lastSentAt: rows[0] ? new Date(rows[0].created_at).getTime() : null,
  };
}

/**
 * `initial` = jen první odeslání, `reminder` = jen připomínka po 24 h,
 * `any` = ruční rozeslání, které zvládne obojí.
 */
type SendMode = "initial" | "reminder" | "any";

function shouldSend(
  mode: SendMode,
  history: { count: number; lastSentAt: number | null }
): boolean {
  const due =
    history.lastSentAt == null ||
    Date.now() - history.lastSentAt >=
      REMINDER_INTERVAL_MS - REMINDER_TOLERANCE_MS;

  if (mode === "initial") return history.count === 0;
  if (mode === "reminder") return history.count > 0 && due;
  return history.count === 0 || due;
}

async function deliver(
  admin: Admin,
  context: EventContext,
  params: {
    kind: EmailNotificationKind;
    transferId?: string | null;
    recipient: Recipient;
    subject: string;
    html: string;
    text: string;
    reminderIndex: number;
  }
): Promise<NotifyResult> {
  if (!params.recipient.email) {
    return { sent: 0, skipped: 1, failed: 0 };
  }

  const result = await sendEmail({
    to: params.recipient.email,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  await logNotification(admin, {
    eventId: context.eventId,
    companyId: context.companyId,
    kind: params.kind,
    transferId: params.transferId ?? null,
    recipientId: params.recipient.id,
    recipientEmail: params.recipient.email,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
    reminderIndex: params.reminderIndex,
  });

  return result.ok
    ? { sent: 1, skipped: 0, failed: 0 }
    : { sent: 0, skipped: 0, failed: 1 };
}

async function sendPaymentRequest(
  admin: Admin,
  context: EventContext,
  transfer: SettlementTransfer,
  mode: SendMode
): Promise<NotifyResult> {
  const debtor = context.recipients.get(transfer.fromUserId);
  if (!debtor?.email) return { sent: 0, skipped: 1, failed: 0 };

  const history = await notificationHistory(admin, {
    eventId: context.eventId,
    kind: "payment_request",
    transferId: transfer.id,
    recipientId: debtor.id,
  });

  if (!shouldSend(mode, history)) return { sent: 0, skipped: 1, failed: 0 };

  const paymentMessage = paymentMessageFor(
    context.companyName,
    context.eventName
  );

  const email = paymentRequestEmail({
    recipientName: debtor.name,
    counterpartyName: transfer.toName,
    companyName: context.companyName,
    eventName: context.eventName,
    amount: transfer.amount,
    iban: transfer.toIban,
    paymentMessage,
    qrUrl: transfer.toIban
      ? qrImageUrl({
          iban: transfer.toIban,
          amount: transfer.amount,
          message: paymentMessage,
          recipientName: transfer.toName,
        })
      : null,
    actionUrl: paymentActionUrl({
      action: "pay",
      eventId: context.eventId,
      transferId: transfer.id,
      userId: debtor.id,
    }),
    eventUrl: eventUrl(context.eventId),
    reminderIndex: history.count,
  });

  return deliver(admin, context, {
    kind: "payment_request",
    transferId: transfer.id,
    recipient: debtor,
    reminderIndex: history.count,
    ...email,
  });
}

async function sendPaymentReceived(
  admin: Admin,
  context: EventContext,
  transfer: SettlementTransfer,
  mode: SendMode
): Promise<NotifyResult> {
  const creditor = context.recipients.get(transfer.toUserId);
  if (!creditor?.email) return { sent: 0, skipped: 1, failed: 0 };

  const history = await notificationHistory(admin, {
    eventId: context.eventId,
    kind: "payment_received",
    transferId: transfer.id,
    recipientId: creditor.id,
  });

  if (!shouldSend(mode, history)) return { sent: 0, skipped: 1, failed: 0 };

  const email = paymentReceivedEmail({
    recipientName: creditor.name,
    counterpartyName: transfer.fromName,
    companyName: context.companyName,
    eventName: context.eventName,
    amount: transfer.amount,
    actionUrl: paymentActionUrl({
      action: "receive",
      eventId: context.eventId,
      transferId: transfer.id,
      userId: creditor.id,
    }),
    eventUrl: eventUrl(context.eventId),
    reminderIndex: history.count,
  });

  return deliver(admin, context, {
    kind: "payment_received",
    transferId: transfer.id,
    recipient: creditor,
    reminderIndex: history.count,
    ...email,
  });
}

async function companyTotals(
  admin: Admin,
  companyId: string
): Promise<CompanyTotals> {
  const { data: events } = await admin
    .from("events")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "closed");

  const ids = (events ?? []).map((e) => e.id);
  if (ids.length === 0) {
    return { eventCount: 0, expenses: 0, revenues: 0, net: 0 };
  }

  const { data: settlements } = await admin
    .from("settlements")
    .select("summary_data")
    .in("event_id", ids);

  let expenses = 0;
  let revenues = 0;
  for (const row of settlements ?? []) {
    const summary = normalizeSettlementSummary(row.summary_data);
    expenses += summary.totalExpenses;
    revenues += summary.totalRevenues;
  }

  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    eventCount: settlements?.length ?? 0,
    expenses: round(expenses),
    revenues: round(revenues),
    net: round(expenses - revenues),
  };
}

async function sendSummaries(
  admin: Admin,
  context: EventContext
): Promise<NotifyResult> {
  const totals = await companyTotals(admin, context.companyId);

  // Souhrn jde všem stranám — účastníkům vyúčtování i správci firmy.
  const audience = [...context.recipients.values()].filter((r) => r.email);

  const results: NotifyResult[] = [];

  for (const recipient of audience) {
    const history = await notificationHistory(admin, {
      eventId: context.eventId,
      kind: "event_summary",
      recipientId: recipient.id,
    });
    if (history.count > 0) {
      results.push({ sent: 0, skipped: 1, failed: 0 });
      continue;
    }

    const email = eventSummaryEmail({
      recipientName: recipient.name,
      companyName: context.companyName,
      eventName: context.eventName,
      closedAt: context.closedAt,
      totalExpenses: context.summary.totalExpenses,
      totalRevenues: context.summary.totalRevenues,
      totalAmount: context.summary.totalAmount,
      averageShare: context.summary.averageShare,
      members: context.summary.members.map((m) => ({
        name: m.name,
        expenses: m.expenses,
        revenues: m.revenues,
        share: m.share,
        balance: m.balance,
        isRecipient: m.userId === recipient.id,
      })),
      transfers: context.summary.transfers.map((tr) => ({
        fromName: tr.fromName,
        toName: tr.toName,
        amount: tr.amount,
      })),
      companyTotals: totals,
      eventUrl: eventUrl(context.eventId),
    });

    results.push(
      await deliver(admin, context, {
        kind: "event_summary",
        recipient,
        reminderIndex: 0,
        ...email,
      })
    );
  }

  return mergeResults(...results, EMPTY_RESULT);
}

async function withContext(
  eventId: string,
  fn: (admin: Admin, context: EventContext) => Promise<NotifyResult>
): Promise<NotifyResult> {
  if (getEmailConfig().provider === "none") return { ...EMPTY_RESULT };

  const admin = createServiceClient();
  if (!admin) {
    console.warn(
      "[splitnito/email] Chybí SUPABASE_SERVICE_ROLE_KEY — notifikace se neodesílají."
    );
    return { ...EMPTY_RESULT };
  }

  const context = await loadEventContext(admin, eventId);
  if (!context || !context.notifyEmails) return { ...EMPTY_RESULT };

  try {
    return await fn(admin, context);
  } catch (error) {
    console.error("[splitnito/email] notifikace selhaly", error);
    return { ...EMPTY_RESULT, failed: 1 };
  }
}

/** Po uzavření akce: výzva k platbě všem, kdo mají poslat peníze. */
export async function notifyEventClosed(
  eventId: string
): Promise<NotifyResult> {
  return withContext(eventId, async (admin, context) => {
    if (context.summary.transfers.length === 0) {
      return sendSummaries(admin, context);
    }

    const results: NotifyResult[] = [];
    for (const transfer of context.summary.transfers) {
      if (transfer.status !== "pending") continue;
      results.push(
        await sendPaymentRequest(admin, context, transfer, "initial")
      );
    }
    return mergeResults(...results, EMPTY_RESULT);
  });
}

/** Plátce označil platbu jako odeslanou → informuj příjemce. */
export async function notifyPaymentSent(
  eventId: string,
  transferId: string
): Promise<NotifyResult> {
  return withContext(eventId, async (admin, context) => {
    const transfer = context.summary.transfers.find((t) => t.id === transferId);
    if (!transfer || transfer.status !== "sent") return { ...EMPTY_RESULT };
    return sendPaymentReceived(admin, context, transfer, "initial");
  });
}

/** Příjemce potvrdil poslední platbu → souhrn pro všechny. */
export async function notifyPaymentConfirmed(
  eventId: string
): Promise<NotifyResult> {
  return withContext(eventId, async (admin, context) => {
    if (!context.summary.allPaid) return { ...EMPTY_RESULT };
    return sendSummaries(admin, context);
  });
}

/** Ruční „rozeslat znovu“ z detailu akce. */
export async function resendPendingNotifications(
  eventId: string
): Promise<NotifyResult> {
  return withContext(eventId, async (admin, context) => {
    const results: NotifyResult[] = [];
    for (const transfer of context.summary.transfers) {
      if (transfer.status === "pending") {
        results.push(await sendPaymentRequest(admin, context, transfer, "any"));
      } else if (transfer.status === "sent") {
        results.push(await sendPaymentReceived(admin, context, transfer, "any"));
      }
    }
    return mergeResults(...results, EMPTY_RESULT);
  });
}

export type ReminderSweepResult = NotifyResult & { events: number };

/** Denní cron: připomínky ke všem nedoplaceným uzavřeným akcím. */
export async function runReminderSweep(): Promise<ReminderSweepResult> {
  if (getEmailConfig().provider === "none") {
    return { ...EMPTY_RESULT, events: 0 };
  }

  const admin = createServiceClient();
  if (!admin) {
    return { ...EMPTY_RESULT, events: 0 };
  }

  const { data: events } = await admin
    .from("events")
    .select("id")
    .eq("status", "closed")
    .eq("notify_emails", true);

  const results: NotifyResult[] = [];
  let touched = 0;

  for (const event of events ?? []) {
    const context = await loadEventContext(admin, event.id);
    if (!context || context.summary.allPaid) continue;

    touched += 1;
    for (const transfer of context.summary.transfers) {
      if (transfer.status === "pending") {
        results.push(
          await sendPaymentRequest(admin, context, transfer, "reminder")
        );
      } else if (transfer.status === "sent") {
        results.push(
          await sendPaymentReceived(admin, context, transfer, "reminder")
        );
      }
    }
  }

  return { ...mergeResults(...results, EMPTY_RESULT), events: touched };
}