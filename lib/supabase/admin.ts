import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseUrl,
  requireSupabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/lib/types/database";

/** Service-role klient — jen na serveru, obchází RLS (mazání storage). */
export function createServiceClient() {
  const url = getSupabaseUrl() ?? requireSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/object/public/receipts/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
