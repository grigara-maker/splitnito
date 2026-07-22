"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  calculateSettlement,
  normalizeSettlementSummary,
} from "@/lib/settlement";
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
    const d = new Date(purchasedAtRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Neplatné datum nákupu." as const };
    }
    purchasedAt = d.toISOString();
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
  const [{ data: members }, { data: receipts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, iban, role")
      .eq("company_id", profile.company_id)
      .eq("role", "member"),
    supabase
      .from("receipts")
      .select("user_id, total_amount")
      .eq("event_id", eventId),
  ]);

  if (!members?.length) {
    return {
      error:
        "Pro vyúčtování potřebujete alespoň jednoho uživatele ve firmě (ne správce).",
    };
  }

  const memberIds = new Set(members.map((m) => m.id));
  const paidByUser = new Map<string, number>();
  for (const r of receipts ?? []) {
    if (!r.user_id || !memberIds.has(r.user_id)) continue;
    paidByUser.set(
      r.user_id,
      (paidByUser.get(r.user_id) ?? 0) + Number(r.total_amount)
    );
  }

  const summary = calculateSettlement(
    members.map((m) => ({
      userId: m.id,
      name: m.name,
      iban: m.iban,
      paid: paidByUser.get(m.id) ?? 0,
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
