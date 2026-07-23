import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export type AppSession = {
  userId: string;
  profile: Pick<Profile, "id" | "name" | "company_id" | "role">;
};

/**
 * Jedna auth + profile načtení na request (layout i stránky sdílí cache).
 */
export const getAppSession = cache(async (): Promise<AppSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  return { userId: user.id, profile };
});
