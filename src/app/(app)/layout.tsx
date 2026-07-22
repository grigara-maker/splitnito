import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("profiles query failed", profileError);
  }

  if (!profile) {
    redirect("/register");
  }

  const [{ data: company }, { data: events }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, invite_code")
      .eq("id", profile.company_id)
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, name, status")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[linear-gradient(180deg,oklch(0.985_0.01_200)_0%,oklch(0.96_0.015_190)_100%)]">
      <AppNav
        profileName={profile.name}
        companyName={company?.name ?? "Firma"}
        events={events ?? []}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        <Link
          href="/dashboard"
          className="font-heading font-medium text-foreground"
        >
          Splitnito
        </Link>
        {" · "}
        chytré vyúčtování firemních nákladů
      </footer>
    </div>
  );
}
