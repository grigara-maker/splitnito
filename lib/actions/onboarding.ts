"use server";

import { redirect } from "next/navigation";

import { isValidIban, normalizeIban } from "@/lib/iban";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/lib/actions/auth";

/** Dokončení uživatelského profilu (jméno, IBAN, volitelně invite firmy). */
export async function completeOnboardingAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  if (!name) {
    return { error: "Jméno je povinné." };
  }

  let iban: string | null = null;
  if (ibanRaw) {
    if (!isValidIban(ibanRaw)) {
      return { error: "IBAN není platný." };
    }
    iban = normalizeIban(ibanRaw);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nejste přihlášeni." };
  }

  const { error } = await supabase.rpc("complete_user_setup", {
    p_name: name,
    p_iban: iban,
    p_invite_code: inviteCode || null,
    p_company_name: null,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
