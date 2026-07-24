"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  calculateSettlement,
  normalizeSettlementSummary,
} from "@/lib/settlement";
import { datetimeLocalPragueToIso } from "@/lib/datetime-prague";
import {
  createServiceClient,
  storagePathFromPublicUrl,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, ReceiptItem } from "@/lib/types/database";
import { normalizeReceiptItems } from "@/lib/types/database";

export type ActionState = {
  error?: string;
  success?: string;
};

async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("Profile missing");
  }

  return { supabase, user, profile };
}

export async function createEventAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Název akce je povinný." };

  const { supabase, profile } = await requireProfile();

  const { data, error } = await supabase
    .from("events")
    .insert({
      name,
      company_id: profile.company_id,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Akci se nepodařilo vytvořit." };
  }

  revalidatePath("/dashboard");
  redirect(`/events/${data.id}`);
}

function parseReceiptFields(formData: FormData) {
  const vendor = String(formData.get("vendor") ?? "").trim();
  const amountRaw = String(formData.get("totalAmount") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const purchasedAtRaw = String(formData.get("purchasedAt") ?? "").trim();

  if (!vendor || !amountRaw) {
    return { error: "Dodavatel a částka jsou povinné." as const };
  }

  const totalAmount = Number(amountRaw.replace(",", "."));
  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return { error: "Neplatná částka." as const };
  }

  let items: ReceiptItem[] | null = null;
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as unknown;
      const normalized = normalizeReceiptItems(parsed);
      items = normalized.length > 0 ? normalized : null;
    } catch {
      return { error: "Neplatný formát položek." as const };
    }
  }

  let purchasedAt: string | null = null;
  if (purchasedAtRaw) {
    const iso = datetimeLocalPragueToIso(purchasedAtRaw);
    if (!iso) {
      return { error: "Neplatné datum nákupu." as const };
    }
    purchasedAt = iso;
  }

  return { vendor, totalAmount, items, imageUrl, purchasedAt };
}

export async function createReceiptAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "Chybí akce." };

  const parsed = parseReceiptFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, user, profile } = await requireProfile();

  if (profile.role === "company") {
    return {
      error:
        "Správce firmy nemůže přidávat doklady. Doklady nahrávají jen uživatelé.",
    };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "active") {
    return { error: "Doklad lze přidat jen k aktivní akci." };
  }

  const { error } = await supabase.from("receipts").insert({
    event_id: eventId,
    user_id: user.id,
    uploader_name: profile.name,
    vendor: parsed.vendor,
    total_amount: parsed.totalAmount,
    items: parsed.items as Json | null,
    image_url: parsed.imageUrl,
    purchased_at: parsed.purchasedAt ?? new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: "Doklad byl uložen." };
}

export async function updateReceiptAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const receiptId = String(formData.get("receiptId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!receiptId || !eventId) return { error: "Chybí doklad." };

  const parsed = parseReceiptFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, user, profile } = await requireProfile();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, user_id, event_id")
    .eq("id", receiptId)
    .maybeSingle();

  if (!receipt) return { error: "Doklad nenalezen." };

  const canEdit =
    receipt.user_id === user.id || profile.role === "company";
  if (!canEdit) {
    return { error: "Nemáte oprávnění upravit tento doklad." };
  }

  const { error } = await supabase
    .from("receipts")
    .update({
      vendor: parsed.vendor,
      total_amount: parsed.totalAmount,
      items: parsed.items as Json | null,
      image_url: parsed.imageUrl,
      purchased_at: parsed.purchasedAt,
    })
    .eq("id", receiptId);

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { success: "Doklad byl upraven." };
}

export async function deleteReceiptAction(
  receiptId: string,
  eventId: string
): Promise<ActionState> {
  const { supabase, user, profile } = await requireProfile();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, user_id")
    .eq("id", receiptId)
    .maybeSingle();

  if (!receipt) return { error: "Doklad nenalezen." };

  const canDelete =
    receipt.user_id === user.id || profile.role === "company";
  if (!canDelete) {
    return { error: "Nemáte oprávnění smazat tento doklad." };
  }

  const { error } = await supabase.from("receipts").delete().eq("id", receiptId);
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { success: "Doklad byl smazán." };
}

/** Image URL se stahuje až při otevření detailu dokladu. */
export async function getReceiptImageUrlAction(
  receiptId: string
): Promise<{ url: string | null; error?: string }> {
  const { supabase, profile } = await requireProfile();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("image_url, event_id")
    .eq("id", receiptId)
    .maybeSingle();

  if (!receipt) return { url: null, error: "Doklad nenalezen." };

  const { data: event } = await supabase
    .from("events")
    .select("company_id")
    .eq("id", receipt.event_id)
    .maybeSingle();

  if (!event || event.company_id !== profile.company_id) {
    return { url: null, error: "Nemáte přístup k tomuto dokladu." };
  }

  return { url: receipt.image_url ?? null };
}

/** Slim fingerprinty dokladů celé firmy — načítá se až po prvním paintu stránky. */
export async function getCompanyReceiptDuplicatesAction(): Promise<
  {
    id: string;
    vendor: string;
    totalAmount: number;
    purchasedAt: string | null;
    createdAt: string;
    eventId: string;
    eventName: string;
  }[]
> {
  const { supabase, profile } = await requireProfile();

  const { data: events } = await supabase
    .from("events")
    .select("id, name")
    .eq("company_id", profile.company_id);

  const eventIds = (events ?? []).map((e) => e.id);
  if (eventIds.length === 0) return [];

  const nameByEvent = new Map((events ?? []).map((e) => [e.id, e.name]));

  const { data: rows } = await supabase
    .from("receipts")
    .select("id, vendor, total_amount, purchased_at, created_at, event_id")
    .in("event_id", eventIds);

  return (rows ?? []).map((r) => ({
    id: r.id,
    vendor: r.vendor,
    totalAmount: Number(r.total_amount),
    purchasedAt: r.purchased_at,
    createdAt: r.created_at,
    eventId: r.event_id,
    eventName: nameByEvent.get(r.event_id) ?? "jiná akce",
  }));
}

function parseRevenueFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".");
  const amount = Number(amountRaw);

  if (!name) return { error: "Název akce / tržby je povinný." as const };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Zadejte platnou částku tržby." as const };
  }

  return { name, amount: Math.round(amount * 100) / 100 };
}

export async function createRevenueAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "Chybí akce." };

  const parsed = parseRevenueFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, user, profile } = await requireProfile();

  if (profile.role === "company") {
    return {
      error:
        "Správce firmy nemůže přidávat tržby. Tržby přidávají jen uživatelé.",
    };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "active") {
    return { error: "Tržbu lze přidat jen k aktivní akci." };
  }

  const { error } = await supabase.from("revenues").insert({
    event_id: eventId,
    user_id: user.id,
    uploader_name: profile.name,
    name: parsed.name,
    amount: parsed.amount,
  });

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { success: "Tržba byla uložena." };
}

export async function updateRevenueAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const revenueId = String(formData.get("revenueId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!revenueId || !eventId) return { error: "Chybí tržba." };

  const parsed = parseRevenueFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, user, profile } = await requireProfile();

  const { data: revenue } = await supabase
    .from("revenues")
    .select("id, user_id")
    .eq("id", revenueId)
    .maybeSingle();

  if (!revenue) return { error: "Tržba nenalezena." };

  const canEdit =
    revenue.user_id === user.id || profile.role === "company";
  if (!canEdit) {
    return { error: "Nemáte oprávnění upravit tuto tržbu." };
  }

  const { error } = await supabase
    .from("revenues")
    .update({
      name: parsed.name,
      amount: parsed.amount,
    })
    .eq("id", revenueId);

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { success: "Tržba byla upravena." };
}

export async function deleteRevenueAction(
  revenueId: string,
  eventId: string
): Promise<ActionState> {
  const { supabase, user, profile } = await requireProfile();

  const { data: revenue } = await supabase
    .from("revenues")
    .select("id, user_id")
    .eq("id", revenueId)
    .maybeSingle();

  if (!revenue) return { error: "Tržba nenalezena." };

  const canDelete =
    revenue.user_id === user.id || profile.role === "company";
  if (!canDelete) {
    return { error: "Nemáte oprávnění smazat tuto tržbu." };
  }

  const { error } = await supabase
    .from("revenues")
    .delete()
    .eq("id", revenueId);
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { success: "Tržba byla smazána." };
}

export async function closeEventAction(eventId: string): Promise<ActionState> {
  const { supabase, profile } = await requireProfile();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event || event.company_id !== profile.company_id) {
    return { error: "Akce nenalezena." };
  }
  if (event.status === "closed") {
    return { error: "Akce je už uzavřená." };
  }

  // Vyúčtování jen mezi uživateli (ne správcem firmy)
  const [{ data: members }, { data: receipts }, { data: revenues }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, iban, role")
        .eq("company_id", profile.company_id)
        .eq("role", "member"),
      supabase
        .from("receipts")
        .select("user_id, total_amount")
        .eq("event_id", eventId),
      supabase
        .from("revenues")
        .select("user_id, amount")
        .eq("event_id", eventId),
    ]);

  if (!members?.length) {
    return {
      error:
        "Pro vyúčtování potřebujete alespoň jednoho uživatele ve firmě (ne správce).",
    };
  }

  const memberIds = new Set(members.map((m) => m.id));
  const expensesByUser = new Map<string, number>();
  for (const r of receipts ?? []) {
    if (!r.user_id || !memberIds.has(r.user_id)) continue;
    expensesByUser.set(
      r.user_id,
      (expensesByUser.get(r.user_id) ?? 0) + Number(r.total_amount)
    );
  }

  const revenuesByUser = new Map<string, number>();
  for (const rev of revenues ?? []) {
    if (!rev.user_id || !memberIds.has(rev.user_id)) continue;
    revenuesByUser.set(
      rev.user_id,
      (revenuesByUser.get(rev.user_id) ?? 0) + Number(rev.amount)
    );
  }

  const summary = calculateSettlement(
    members.map((m) => ({
      userId: m.id,
      name: m.name,
      iban: m.iban,
      expenses: expensesByUser.get(m.id) ?? 0,
      revenues: revenuesByUser.get(m.id) ?? 0,
    }))
  );

  const { error: settlementError } = await supabase.from("settlements").insert({
    event_id: eventId,
    summary_data: summary as unknown as Json,
  });

  if (settlementError) {
    return { error: settlementError.message };
  }

  const { error: eventError } = await supabase
    .from("events")
    .update({ status: "closed" })
    .eq("id", eventId);

  if (eventError) {
    return { error: eventError.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { success: "Vyúčtování bylo uzavřeno." };
}

export async function deleteEventAction(eventId: string): Promise<ActionState> {
  const { supabase, profile } = await requireProfile();

  const { data: event } = await supabase
    .from("events")
    .select("id, company_id, name")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.company_id !== profile.company_id) {
    return { error: "Akce nenalezena." };
  }

  const { data: receipts } = await supabase
    .from("receipts")
    .select("image_url")
    .eq("event_id", eventId);

  const paths = (receipts ?? [])
    .map((r) => storagePathFromPublicUrl(r.image_url))
    .filter((p): p is string => Boolean(p));

  const admin = createServiceClient();
  if (admin && paths.length > 0) {
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from("receipts").remove(paths.slice(i, i + 100));
    }
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) {
    if (/permission denied|row-level security|RLS/i.test(error.message)) {
      return {
        error:
          "Chybí oprávnění ke smazání akce. Spusťte SQL supabase/migration_delete_event.sql.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { success: "Akce byla smazána." };
}

export async function reopenEventAction(eventId: string): Promise<ActionState> {
  const { supabase, profile } = await requireProfile();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event || event.company_id !== profile.company_id) {
    return { error: "Akce nenalezena." };
  }
  if (event.status !== "closed") {
    return { error: "Akce není uzavřená." };
  }

  const { data: settlement } = await supabase
    .from("settlements")
    .select("summary_data")
    .eq("event_id", eventId)
    .maybeSingle();

  if (settlement?.summary_data) {
    const summary = normalizeSettlementSummary(settlement.summary_data);
    if (summary.allPaid && summary.transfers.length > 0) {
      return {
        error:
          "Vyúčtování je už kompletně zaplacené a nelze ho znovu otevřít.",
      };
    }
  }

  await supabase.from("settlements").delete().eq("event_id", eventId);

  const { error } = await supabase
    .from("events")
    .update({ status: "active" })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  revalidatePath("/history");
  return { success: "Akce byla znovu otevřena." };
}

export async function confirmPaymentAction(
  eventId: string,
  transferId: string
): Promise<ActionState> {
  const { supabase, user } = await requireProfile();

  const { data: settlement } = await supabase
    .from("settlements")
    .select("id, summary_data")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!settlement?.summary_data) {
    return { error: "Vyúčtování nenalezeno." };
  }

  const summary = normalizeSettlementSummary(settlement.summary_data);
  const transfer = summary.transfers.find((t) => t.id === transferId);

  if (!transfer) {
    return { error: "Platba nenalezena." };
  }

  // QR platby jen mezi uživateli — potvrzuje příjemce
  if (transfer.toUserId !== user.id) {
    return { error: "Potvrdit platbu může jen příjemce." };
  }

  summary.transfers = summary.transfers.map((t) =>
    t.id === transferId ? { ...t, status: "confirmed" as const } : t
  );
  summary.allPaid =
    summary.transfers.length === 0 ||
    summary.transfers.every((t) => t.status === "confirmed");

  const { error } = await supabase
    .from("settlements")
    .update({ summary_data: summary as unknown as Json })
    .eq("id", settlement.id);

  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return {
    success: summary.allPaid
      ? "Všechny platby potvrzeny — vyúčtování je hotové."
      : "Platba potvrzena.",
  };
}
