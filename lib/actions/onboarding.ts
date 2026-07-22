"use server";

import { redirect } from "next/navigation";

import { isValidIban, normalizeIban } from "@/lib/iban";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/lib/actions/auth";

export async function completeOnboardingAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();
  const mode = String(formData.get("mode") ?? "create");
  const companyName = String(formData.get("companyName") ?? "").trim();
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

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    redirect("/dashboard");
  }

  let companyId: string;

  if (mode === "join") {
    if (!inviteCode) {
      return { error: "Zadejte invite kód firmy." };
    }
    const { data: companies, error } = await supabase.rpc(
      "get_company_by_invite",
      { code: inviteCode }
    );
    if (error || !companies?.length) {
      return { error: "Invite kód není platný." };
    }
    companyId = companies[0].id;
  } else {
    if (!companyName) {
      return { error: "Zadejte název firmy." };
    }
    const { data: company, error } = await supabase
      .from("companies")
      .insert({ name: companyName })
      .select("id")
      .single();
    if (error || !company) {
      return { error: error?.message ?? "Firmu se nepodařilo vytvořit." };
    }
    companyId = company.id;
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    company_id: companyId,
    name,
    iban,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  redirect("/dashboard");
}
