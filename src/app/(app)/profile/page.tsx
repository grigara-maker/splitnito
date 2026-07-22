import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/app/profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, iban, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/register");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name, invite_code")
    .eq("id", profile.company_id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Profil
        </h1>
        <p className="mt-1 text-muted-foreground">
          Upravte jméno a IBAN pro vyúčtování ve Splitnito.
        </p>
      </div>
      <ProfileForm
        name={profile.name}
        iban={profile.iban}
        inviteCode={company?.invite_code ?? "—"}
        companyName={company?.name ?? "—"}
      />
    </div>
  );
}
