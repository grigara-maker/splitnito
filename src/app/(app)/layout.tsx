import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/app-nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error(error);
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          Chybí konfigurace Splitnito
        </h1>
        <p className="text-sm text-muted-foreground">
          Nastavte <code>NEXT_PUBLIC_SUPABASE_URL</code> a{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ve Vercelu a proveďte
          redeploy.
        </p>
      </div>
    );
  }

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

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, invite_code")
    .eq("id", profile.company_id)
    .maybeSingle();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[linear-gradient(180deg,oklch(0.985_0.01_200)_0%,oklch(0.96_0.015_190)_100%)]">
      <AppNav
        profileName={
          profile.role === "company"
            ? (company?.name ?? profile.name)
            : profile.name
        }
        companyName={company?.name ?? "Firma"}
        isCompanyAdmin={profile.role === "company"}
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
