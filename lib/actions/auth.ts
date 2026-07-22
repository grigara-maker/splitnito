"use server";

import { revalidatePath } from "next/cache";
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
  const accountType = String(formData.get("accountType") ?? "member");

  if (!email || !password) {
    return { error: "Vyplňte e-mail i heslo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Neplatné přihlašovací údaje." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      const expected = accountType === "company" ? "company" : "member";
      if (profile.role !== expected) {
        // Soft warning path: still allow login, UI is role-based anyway
      }
    }
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
  const accountType = String(formData.get("accountType") ?? "member");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  if (!email || !password || !name) {
    return { error: "Vyplňte jméno, e-mail a heslo." };
  }
  if (password.length < 6) {
    return { error: "Heslo musí mít alespoň 6 znaků." };
  }

  if (accountType === "company" && !companyName) {
    return { error: "Zadejte název firmy." };
  }
  if (accountType === "member" && !inviteCode) {
    return { error: "Zadejte kód firmy, ke které se připojujete." };
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
    options: {
      data: { name, accountType },
    },
  });

  if (signUpError || !signUpData.user) {
    const message = signUpError?.message ?? "Registraci se nepodařilo dokončit.";
    if (/invalid path/i.test(message)) {
      return {
        error:
          "Špatná Supabase URL. V nastavení musí být jen https://XXXX.supabase.co (bez /rest/v1).",
      };
    }
    return { error: message };
  }

  if (!signUpData.session) {
    return {
      error:
        "Účet byl vytvořen, ale e-mail vyžaduje potvrzení. Ve Supabase vypněte Confirm email, nebo potvrďte e-mail a pak se přihlaste.",
    };
  }

  const { error: setupError } = await supabase.rpc("complete_user_setup", {
    p_name: name,
    p_iban: iban,
    p_invite_code: accountType === "member" ? inviteCode : null,
    p_company_name: accountType === "company" ? companyName : null,
    p_role: accountType === "company" ? "company" : "member",
  });

  if (setupError) {
    const message = setupError.message;
    if (/Could not find the function|schema cache/i.test(message)) {
      return {
        error:
          "V Supabase chybí aktuální funkce complete_user_setup. Spusťte SQL supabase/migration_roles_receipts.sql.",
      };
    }
    return { error: message };
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

export async function removeMemberAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Chybí uživatel." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_company_member", {
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/company");
  return { success: "Uživatel byl odstraněn." };
}
