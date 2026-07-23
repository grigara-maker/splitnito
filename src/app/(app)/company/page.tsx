import { redirect } from "next/navigation";

import { CompanyNameForm } from "@/components/app/company-name-form";
import { DeleteAccountForm } from "@/components/app/delete-account-form";
import { RemoveMemberButton } from "@/components/app/remove-member-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inviteRegisterUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");
  if (profile.role !== "company") redirect("/profile");

  const { data: company } = await supabase
    .from("companies")
    .select("name, invite_code")
    .eq("id", profile.company_id)
    .single();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, name, role, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  const inviteUrl = inviteRegisterUrl(company?.invite_code ?? "");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Nastavení
        </h1>
        <p className="mt-1 text-muted-foreground">
          Profil správce firmy ve Splitnito — název, pozvánky, uživatelé.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Firma</CardTitle>
          <CardDescription>
            Účet správce se jmenuje podle firmy. Doklady a IBAN mají jen
            uživatelé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <CompanyNameForm companyName={company?.name ?? ""} />
          <div>
            <p className="text-sm text-muted-foreground">Kód firmy</p>
            <p className="mt-1 font-mono text-2xl tracking-wider">
              {company?.invite_code}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Odkaz pro pozvání</p>
            <p className="mt-1 break-all text-sm font-medium">{inviteUrl}</p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Uživatelé firmy
        </h2>
        <ul className="divide-y divide-border/60 rounded-xl bg-card ring-1 ring-foreground/10">
          {(members ?? []).map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString("cs-CZ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={m.role === "company" ? "secondary" : "outline"}>
                  {m.role === "company" ? "Firma" : "Uživatel"}
                </Badge>
                {m.role === "member" ? (
                  <RemoveMemberButton userId={m.id} name={m.name} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <DeleteAccountForm mode="company" companyName={company?.name ?? ""} />
    </div>
  );
}
