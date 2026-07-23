"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { registerAction, type AuthState } from "@/lib/actions/auth";
import { AppleAuthButton } from "@/components/auth/apple-auth-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initial: AuthState = {};

export function RegisterForm({
  defaultInvite,
}: {
  defaultInvite?: string;
}) {
  const [state, formAction, pending] = useActionState(registerAction, initial);
  const [accountType, setAccountType] = useState<"company" | "member">(
    defaultInvite ? "member" : "company"
  );

  const appleNext = defaultInvite
    ? `/onboarding?invite=${encodeURIComponent(defaultInvite)}`
    : "/onboarding";

  return (
    <Card className="w-full max-w-md bg-card/90 shadow-lg shadow-primary/5 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Registrace</CardTitle>
        <CardDescription>
          Zvolte, jestli zakládáte firmu, nebo se připojujete jako uživatel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AppleAuthButton
          next={appleNext}
          label="Registrovat se přes Apple"
        />
        <p className="text-center text-xs text-muted-foreground">
          Po Apple dokončíte firmu nebo kód pozvánky v dalším kroku.
        </p>

        <div className="relative py-1 text-center text-xs text-muted-foreground">
          <span className="relative z-10 bg-card px-2">nebo e-mailem</span>
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
          />
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="accountType" value={accountType} />

          <Tabs
            value={accountType}
            onValueChange={(v) => setAccountType(v as "company" | "member")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="company">Jsem firma</TabsTrigger>
              <TabsTrigger value="member">Jsem uživatel</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Účet správce se jmenuje podle firmy. Doklady přidávají jen
                uživatelé — firma spravuje akce a vyúčtování.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="companyName">Název firmy</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Moje s.r.o."
                  required={accountType === "company"}
                />
              </div>
            </TabsContent>

            <TabsContent value="member" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Zadejte kód firmy — účet se k ní trvale přidruží. Doklady a QR
                platby probíhají mezi uživateli.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="inviteCode">Kód firmy</Label>
                <Input
                  id="inviteCode"
                  name="inviteCode"
                  placeholder="ABCD1234"
                  required={accountType === "member"}
                  defaultValue={defaultInvite ?? ""}
                  className="uppercase"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Vaše jméno</Label>
                <Input
                  id="name"
                  name="name"
                  required={accountType === "member"}
                  placeholder="Jan Novák"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="iban">IBAN (volitelné)</Label>
                <Input
                  id="iban"
                  name="iban"
                  placeholder="CZ65 0800 0000 0012 3456 7890"
                />
                <p className="text-xs text-muted-foreground">
                  Pro příjem QR plateb při vyúčtování.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vy@firma.cz"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="min. 6 znaků"
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" loading={pending}>
            {accountType === "company" ? "Založit firmu" : "Připojit se k firmě"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Už máte účet?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Přihlásit se
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
