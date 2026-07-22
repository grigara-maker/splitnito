"use server";

import { redirect } from "next/navigation";

import { isValidIban, normalizeIban } from "@/lib/iban";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Vyplňte e-mail i heslo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Neplatné přihlašovací údaje." };
  }

  redirect("/dashboard");
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();
  const mode = String(formData.get("mode") ?? "create");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  if (!email || !password || !name) {
    return { error: "Vyplňte jméno, e-mail a heslo." };
  }
  if (password.length < 6) {
    return { error: "Heslo musí mít alespoň 6 znaků." };
  }

  let iban: string | null = null;
  if (ibanRaw) {
    if (!isValidIban(ibanRaw)) {
      return { error: "IBAN není platný. Zkontrolujte formát." };
    }
    iban = normalizeIban(ibanRaw);
  }

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUpData.user) {
    return {
      error: signUpError?.message ?? "Registraci se nepodařilo dokončit.",
    };
  }

  const userId = signUpData.user.id;
  let companyId: string;

  if (mode === "join") {
    if (!inviteCode) {
      return { error: "Zadejte invite kód firmy." };
    }

    const { data: companies, error: inviteError } = await supabase.rpc(
      "get_company_by_invite",
      { code: inviteCode }
    );

    if (inviteError || !companies?.length) {
      return { error: "Invite kód není platný." };
    }

    companyId = companies[0].id;
  } else {
    if (!companyName) {
      return { error: "Zadejte název firmy." };
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName })
      .select("id")
      .single();

    if (companyError || !company) {
      return {
        error:
          companyError?.message ??
          "Firmu se nepodařilo vytvořit. Zkontrolujte databázi.",
      };
    }

    companyId = company.id;
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    company_id: companyId,
    name,
    iban,
  });

  if (profileError) {
    return {
      error:
        profileError.message ??
        "Profil se nepodařilo vytvořit. Kontaktujte podporu.",
    };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfileAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();

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

  const { error } = await supabase
    .from("profiles")
    .update({ name, iban })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: "Profil byl uložen." };
}
