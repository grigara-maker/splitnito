"use server";

import { redirect } from "next/navigation";

import { isValidIban, normalizeIban } from "@/lib/iban";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/lib/actions/auth";

export async function completeOnboardingAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const accountType = String(formData.get("accountType") ?? "member");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  const memberName = String(formData.get("name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();

  if (accountType === "company") {
    if (!companyName) return { error: "Zadejte název firmy." };
  } else {
    if (!memberName) return { error: "Jméno je povinné." };
    if (!inviteCode) return { error: "Zadejte kód firmy." };
  }

  let iban: string | null = null;
  if (accountType === "member" && ibanRaw) {
    if (!isValidIban(ibanRaw)) {
      return { error: "IBAN není platný." };
    }
    iban = normalizeIban(ibanRaw);
  }

  const displayName =
    accountType === "company" ? companyName : memberName;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nejste přihlášeni." };
  }

  const { error } = await supabase.rpc("complete_user_setup", {
    p_name: displayName,
    p_iban: accountType === "member" ? iban : null,
    p_invite_code: accountType === "member" ? inviteCode : null,
    p_company_name: accountType === "company" ? companyName : null,
    p_role: accountType === "company" ? "company" : "member",
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
