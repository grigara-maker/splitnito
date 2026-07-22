import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/app/onboarding-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    redirect("/dashboard");
  }

  const defaultName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : "";

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_200)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.985_0.01_200)_0%,_oklch(0.96_0.02_180)_100%)]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <p className="font-heading text-lg font-semibold">Splitnito</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
            Dokončete účet
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ještě chybí profil a firma.
          </p>
        </div>
        <Card className="bg-card/90 shadow-lg backdrop-blur-md">
          <CardHeader>
            <CardTitle>Firma a profil</CardTitle>
            <CardDescription>
              Vytvořte firmu, nebo se připojte přes invite kód.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm defaultName={defaultName} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
