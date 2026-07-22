"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { calculateSettlement } from "@/lib/settlement";
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

export async function createReceiptAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const vendor = String(formData.get("vendor") ?? "").trim();
  const amountRaw = String(formData.get("totalAmount") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  if (!eventId || !vendor || !amountRaw) {
    return { error: "Dodavatel a částka jsou povinné." };
  }

  const totalAmount = Number(amountRaw.replace(",", "."));
  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return { error: "Neplatná částka." };
  }

  let items: ReceiptItem[] | null = null;
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw) as unknown;
      const normalized = normalizeReceiptItems(parsed);
      items = normalized.length > 0 ? normalized : null;
    } catch {
      return { error: "Neplatný formát položek." };
    }
  }

  const { supabase, user } = await requireProfile();

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
    vendor,
    total_amount: totalAmount,
    items: items as Json | null,
    image_url: imageUrl,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: "Doklad byl uložen." };
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

  const [{ data: members }, { data: receipts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, iban")
      .eq("company_id", profile.company_id),
    supabase.from("receipts").select("user_id, total_amount").eq("event_id", eventId),
  ]);

  if (!members?.length) {
    return { error: "Firma nemá žádné členy." };
  }

  const paidByUser = new Map<string, number>();
  for (const r of receipts ?? []) {
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
  return { success: "Akce byla uzavřena." };
}
