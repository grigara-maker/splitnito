import type { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal/operator";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MISSING_MIGRATION =
  "V Supabase chybí sloupce pro IČO a souhlas s podmínkami. Spusťte SQL supabase/migration_legal_ico.sql.";

function missingColumn(message: string) {
  return /column .* does not exist|Could not find the '.*' column|schema cache/i.test(
    message
  );
}

/**
 * Po dokončení registrace uloží verzi a čas souhlasu s podmínkami
 * a u firmy ověřené IČO.
 */
export async function recordLegalSetup(
  supabase: Supabase,
  userId: string,
  ico: string | null,
  acceptedAt: string
): Promise<string | null> {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ terms_version: TERMS_VERSION, terms_accepted_at: acceptedAt })
    .eq("id", userId);
  if (profileError) {
    return missingColumn(profileError.message)
      ? MISSING_MIGRATION
      : profileError.message;
  }

  if (ico) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return "Profil nenalezen.";

    const { error: companyError } = await supabase
      .from("companies")
      .update({ ico })
      .eq("id", profile.company_id);
    if (companyError) {
      return missingColumn(companyError.message)
        ? MISSING_MIGRATION
        : companyError.message;
    }
  }

  return null;
}

export const TERMS_REQUIRED_ERROR =
  "Pro registraci je potřeba souhlasit s podmínkami užívání.";
