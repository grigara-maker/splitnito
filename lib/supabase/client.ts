import { createBrowserClient } from "@supabase/ssr";

import {
  requireSupabaseAnonKey,
  requireSupabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/lib/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    requireSupabaseUrl(),
    requireSupabaseAnonKey()
  );
}
