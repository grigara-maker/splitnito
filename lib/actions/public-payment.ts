"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import {
  notifyPaymentConfirmed,
  notifyPaymentSent,
  paymentMessageFor,
} from "@/lib/email/notifications";
import { verifyPaymentToken } from "@/lib/email/tokens";
import {
  normalizeSettlementSummary,
  type SettlementTransfer,
} from "@/lib/settlement";
import { buildSpayd } from "@/lib/spayd";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

export type PublicPaymentView = {
  status: "ok";
  token: string;
  action: "pay" | "receive";
  eventId: string;
  eventName: string;
  companyName: string;
  transfer: SettlementTransfer;
  paymentMessage: string;
  spayd: string | null;
  /** Akce už proběhla — zobrazí se jen potvrzení. */
  alreadyDone: boolean;
  blockedReason: string | null;
};

export type PublicPaymentError = {
  status: "error";
  message: string;
};

export type PublicPaymentResult = PublicPaymentView | PublicPaymentError;

const INVALID: PublicPaymentError = {
  status: "error",
  message:
    "Odkaz je neplatný nebo už vypršel. Otevřete akci přímo ve Splitnito.",
};

async function loadFromToken(token: string) {
  const payload = verifyPaymentToken(token);
  if (!payload) return null;

  const admin = createServiceClient();
  if (!admin) return null;

  const { data: event } = await admin
    .from("events")
    .select("id, name, status, company_id")
    .eq("id", payload.eventId)
    .maybeSingle();

  if (!event || event.status !== "closed") return null;

  const [{ data: settlement }, { data: company }] = await Promise.all([
    admin
      .from("settlements")
      .select("id, summary_data")
      .eq("event_id", payload.eventId)
      .maybeSingle(),
    admin
      .from("companies")
      .select("name")
      .eq("id", event.company_id)
      .maybeSingle(),
  ]);

  if (!settlement?.summary_data) return null;

  const summary = normalizeSettlementSummary(settlement.summary_data);
  const transfer = summary.transfers.find((t) => t.id === payload.transferId);
  if (!transfer) return null;

  const expectedUserId =
    payload.action === "pay" ? transfer.fromUserId : transfer.toUserId;
  if (expectedUserId !== payload.userId) return null;

  return {
    admin,
    payload,
    event,
    company,
    settlementId: settlement.id,
    summary,
    transfer,
  };
}

export async function getPublicPaymentAction(
  token: string
): Promise<PublicPaymentResult> {
  const loaded = await loadFromToken(token);
  if (!loaded) return INVALID;

  const { payload, event, company, transfer } = loaded;
  const companyName = company?.name ?? "firma";
  const paymentMessage = paymentMessageFor(companyName, event.name);

  const alreadyDone =
    payload.action === "pay"
      ? transfer.status !== "pending"
      : transfer.status === "confirmed";

  const blockedReason =
    payload.action === "receive" && transfer.status === "pending"
      ? "Plátce zatím neoznačil platbu jako odeslanou."
      : null;

  return {
    status: "ok",
    token,
    action: payload.action,
    eventId: event.id,
    eventName: event.name,
    companyName,
    transfer,
    paymentMessage,
    spayd:
      payload.action === "pay" && transfer.toIban
        ? buildSpayd({
            iban: transfer.toIban,
            amount: transfer.amount,
            message: paymentMessage,
            recipientName: transfer.toName,
          })
        : null,
    alreadyDone,
    blockedReason,
  };
}

export type PublicActionState = { error?: string; success?: string };

/**
 * Potvrzení platby z odkazu v e-mailu — ověřuje se HMAC podpis tokenu,
 * takže není potřeba přihlášení.
 */
export async function submitPublicPaymentAction(
  token: string
): Promise<PublicActionState> {
  const loaded = await loadFromToken(token);
  if (!loaded) return { error: INVALID.message };

  const { admin, payload, settlementId, summary, transfer } = loaded;

  if (payload.action === "pay") {
    if (transfer.status === "confirmed") {
      return { success: "Příjemce už platbu potvrdil." };
    }
    if (transfer.status === "sent") {
      return { success: "Platba už je označená jako odeslaná." };
    }
    summary.transfers = summary.transfers.map((t) =>
      t.id === transfer.id ? { ...t, status: "sent" as const } : t
    );
    summary.allPaid = false;
  } else {
    if (transfer.status === "confirmed") {
      return { success: "Přijetí platby už bylo potvrzeno." };
    }
    if (transfer.status === "pending") {
      return { error: "Plátce zatím neoznačil platbu jako odeslanou." };
    }
    summary.transfers = summary.transfers.map((t) =>
      t.id === transfer.id ? { ...t, status: "confirmed" as const } : t
    );
    summary.allPaid = summary.transfers.every((t) => t.status === "confirmed");
  }

  const { error } = await admin
    .from("settlements")
    .update({ summary_data: summary as unknown as Json })
    .eq("id", settlementId);

  if (error) return { error: error.message };

  const eventId = payload.eventId;
  const transferId = transfer.id;
  const isPay = payload.action === "pay";
  const allPaid = summary.allPaid;

  after(async () => {
    if (isPay) {
      await notifyPaymentSent(eventId, transferId);
    } else if (allPaid) {
      await notifyPaymentConfirmed(eventId);
    }
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  revalidatePath("/history");

  return {
    success: isPay
      ? "Díky! Platbu jsme označili jako odeslanou a dali vědět příjemci."
      : allPaid
        ? "Hotovo — všechny platby jsou potvrzené. Souhrn posíláme e-mailem."
        : "Díky! Přijetí platby je potvrzené.",
  };
}
