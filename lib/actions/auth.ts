"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidIban, normalizeIban } from "@/lib/iban";
import {
  createServiceClient,
  storagePathFromPublicUrl,
  wipeReceiptStorageForUsers,
} from "@/lib/supabase/admin";
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
  const accountType = String(formData.get("accountType") ?? "member");
  const companyName = String(formData.get("companyName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  const memberName = String(formData.get("name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").trim();

  if (!email || !password) {
    return { error: "Vyplňte e-mail a heslo." };
  }
  if (password.length < 6) {
    return { error: "Heslo musí mít alespoň 6 znaků." };
  }

  if (accountType === "company") {
    if (!companyName) return { error: "Zadejte název firmy." };
  } else {
    if (!memberName) return { error: "Zadejte své jméno." };
    if (!inviteCode) {
      return { error: "Zadejte kód firmy, ke které se připojujete." };
    }
  }

  let iban: string | null = null;
  if (accountType === "member" && ibanRaw) {
    if (!isValidIban(ibanRaw)) {
      return { error: "IBAN není platný. Zkontrolujte formát." };
    }
    iban = normalizeIban(ibanRaw);
  }

  const displayName =
    accountType === "company" ? companyName : memberName;

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: displayName, accountType },
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
    p_name: displayName,
    p_iban: accountType === "member" ? iban : null,
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nejste přihlášeni." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { error: "Profil nenalezen." };
  }

  if (profile.role === "company") {
    return {
      error: "Správce firmy mění název v sekci Firma, ne osobní jméno.",
    };
  }

  let iban: string | null = null;
  if (ibanRaw) {
    if (!isValidIban(ibanRaw)) {
      return { error: "IBAN není platný." };
    }
    iban = normalizeIban(ibanRaw);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ name, iban })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: "Profil byl uložen." };
}

export async function updateCompanyNameAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const companyName = String(formData.get("companyName") ?? "").trim();
  if (!companyName) {
    return { error: "Název firmy je povinný." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nejste přihlášeni." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "company") {
    return { error: "Název firmy může měnit jen správce." };
  }

  const { error: companyError } = await supabase
    .from("companies")
    .update({ name: companyName })
    .eq("id", profile.company_id);

  if (companyError) {
    return { error: companyError.message };
  }

  // Správce se jmenuje jako firma
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ name: companyName, iban: null })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  revalidatePath("/company");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Název firmy byl uložen." };
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

  // Záloha: Admin API uvolní e-mail i když SQL auth wipe selže
  const admin = createServiceClient();
  if (admin) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }

  revalidatePath("/company");
  return { success: "Uživatel byl odstraněn." };
}

export async function deleteAccountAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const confirm = String(formData.get("confirm") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Nejste přihlášeni." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { error: "Profil nenalezen." };
  }

  // ID všech auth účtů, které musí zmizet (firma = všichni ve firmě)
  let authUserIds: string[] = [user.id];

  if (profile.role === "company") {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .maybeSingle();

    const expected = company?.name?.trim() ?? "";
    if (!expected || confirm !== expected) {
      return {
        error: "Pro smazání firmy zadejte přesný název firmy jako potvrzení.",
      };
    }

    const { data: members } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", profile.company_id);

    authUserIds = (members ?? []).map((m) => m.id);
    if (!authUserIds.includes(user.id)) {
      authUserIds.push(user.id);
    }

    // 1) Storage: všechny nahrané fotky účtenek (podle URL i podle složek uživatelů)
    const { data: events } = await supabase
      .from("events")
      .select("id")
      .eq("company_id", profile.company_id);

    const eventIds = (events ?? []).map((e) => e.id);
    const pathSet = new Set<string>();

    if (eventIds.length > 0) {
      const { data: receipts } = await supabase
        .from("receipts")
        .select("image_url")
        .in("event_id", eventIds);

      for (const r of receipts ?? []) {
        const p = storagePathFromPublicUrl(r.image_url);
        if (p) pathSet.add(p);
      }
    }

    const admin = createServiceClient();
    if (admin) {
      const paths = Array.from(pathSet);
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from("receipts").remove(paths.slice(i, i + 100));
      }
      await wipeReceiptStorageForUsers(authUserIds);
    }
  } else if (confirm.toUpperCase() !== "SMAZAT") {
    return {
      error: "Pro smazání účtu napište SMAZAT do potvrzovacího pole.",
    };
  }

  const { data: result, error } = await supabase.rpc("delete_own_account");

  if (error) {
    if (/Could not find the function|schema cache/i.test(error.message)) {
      return {
        error:
          "V Supabase chybí funkce delete_own_account. Spusťte SQL supabase/migration_fix_delete_company.sql.",
      };
    }
    if (/character varying = uuid|operator does not exist/i.test(error.message)) {
      return {
        error:
          "V Supabase je stará verze mazání účtu. Spusťte SQL supabase/migration_fix_delete_company.sql a zkuste znovu.",
      };
    }
    return { error: error.message };
  }

  // Admin API: jistota, že e-maily (firma i všichni uživatelé) jdou znovu registrovat
  const adminForAuth = createServiceClient();
  if (adminForAuth) {
    await Promise.all(
      authUserIds.map((id) =>
        adminForAuth.auth.admin.deleteUser(id).catch(() => undefined)
      )
    );
  } else if (result === "company") {
    // SQL hard_delete proběhl; bez service role klíče může zůstat identity edge-case
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY chybí — e-maily spoléhají jen na SQL hard_delete_auth_users."
    );
  }

  await supabase.auth.signOut();

  if (result === "company") {
    redirect("/?deleted=company");
  }
  redirect("/?deleted=account");
}
