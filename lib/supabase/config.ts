/**
 * Normalize NEXT_PUBLIC_SUPABASE_URL so clients don't double `/rest/v1` etc.
 * Accepts project URL or a pasted REST/Auth endpoint from the dashboard.
 */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!raw) {
    throw new Error(
      "Chybí NEXT_PUBLIC_SUPABASE_URL. Nastavte ji ve Vercelu / .env.local (např. https://xxxx.supabase.co)."
    );
  }

  let url = raw.replace(/\/+$/, "");
  url = url.replace(/\/rest\/v1$/i, "");
  url = url.replace(/\/auth\/v1$/i, "");
  url = url.replace(/\/storage\/v1$/i, "");
  url = url.replace(/\/functions\/v1$/i, "");

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL musí začínat https:// (např. https://xxxx.supabase.co)."
    );
  }

  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!key) {
    throw new Error(
      "Chybí NEXT_PUBLIC_SUPABASE_ANON_KEY. Nastavte anon/publishable klíč ve Vercelu / .env.local."
    );
  }
  return key;
}
