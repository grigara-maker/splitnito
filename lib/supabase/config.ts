/**
 * Normalize NEXT_PUBLIC_SUPABASE_URL so clients don't double `/rest/v1` etc.
 */
export function getSupabaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!raw) return null;

  let url = raw.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1$/i, "");
  url = url.replace(/\/auth\/v1$/i, "");
  url = url.replace(/\/storage\/v1$/i, "");
  url = url.replace(/\/functions\/v1$/i, "");

  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

export function getSupabaseAnonKey(): string | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return key || null;
}

export function requireSupabaseUrl(): string {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error(
      "Chybí NEXT_PUBLIC_SUPABASE_URL. Nastavte ji ve Vercelu / .env.local (např. https://xxxx.supabase.co)."
    );
  }
  return url;
}

export function requireSupabaseAnonKey(): string {
  const key = getSupabaseAnonKey();
  if (!key) {
    throw new Error(
      "Chybí NEXT_PUBLIC_SUPABASE_ANON_KEY. Nastavte anon/publishable klíč ve Vercelu / .env.local."
    );
  }
  return key;
}
