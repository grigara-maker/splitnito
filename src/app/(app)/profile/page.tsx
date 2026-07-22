import { ProfileForm } from "@/components/app/profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(name, invite_code)")
    .eq("id", user!.id)
    .single();

  const company = Array.isArray(profile!.companies)
    ? profile!.companies[0]
    : profile!.companies;

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
        name={profile!.name}
        iban={profile!.iban}
        inviteCode={company?.invite_code ?? "—"}
        companyName={company?.name ?? "—"}
      />
    </div>
  );
}
