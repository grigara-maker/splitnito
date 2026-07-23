import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseUrl,
  requireSupabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/lib/types/database";

/** Service-role klient — jen na serveru, obchází RLS (mazání storage / auth). */
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

export function storagePathFromPublicUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const marker = "/object/public/receipts/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

/** Smaže všechny soubory ve storage složkách daných uživatelů (receipts/{userId}/…). */
export async function wipeReceiptStorageForUsers(
  userIds: string[]
): Promise<void> {
  const admin = createServiceClient();
  if (!admin || userIds.length === 0) return;

  const paths: string[] = [];

  for (const userId of userIds) {
    const { data: files } = await admin.storage.from("receipts").list(userId, {
      limit: 1000,
    });
    for (const f of files ?? []) {
      if (f.name) paths.push(`${userId}/${f.name}`);
    }
  }

  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from("receipts").remove(paths.slice(i, i + 100));
  }
}

