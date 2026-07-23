"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  registerAction,
  registerWithAppleAction,
  type AuthState,
} from "@/lib/actions/auth";
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

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      <path d="M16.365 1.43c0 1.14-.422 2.21-1.18 3.03-.9.98-2.17 1.55-3.35 1.46-.14-1.1.4-2.25 1.14-3.06.86-.95 2.28-1.64 3.39-1.43zM20.69 17.2c-.57 1.32-.84 1.9-1.57 3.06-.99 1.54-2.39 3.46-4.14 3.48-1.04.02-1.31-.68-2.73-.68-1.42 0-1.73.66-2.76.7-1.73.07-3.05-1.66-4.05-3.19-2.03-3.12-2.24-6.78-.99-8.71.89-1.37 2.3-2.24 3.64-2.24 1.35 0 2.2.7 3.31.7 1.08 0 1.74-.7 3.33-.7 1.19 0 2.45.65 3.34 1.77-2.94 1.62-2.46 5.84.62 6.81z" />
    </svg>
  );
}

export function RegisterForm({
  defaultInvite,
}: {
  defaultInvite?: string;
}) {
  const [emailState, emailAction, emailPending] = useActionState(
    registerAction,
    initial
  );
  const [appleState, appleAction, applePending] = useActionState(
    registerWithAppleAction,
    initial
  );
  const [accountType, setAccountType] = useState<"company" | "member">(
    defaultInvite ? "member" : "company"
  );

  const error = appleState.error ?? emailState.error;
  const pending = emailPending || applePending;

  return (
    <Card className="w-full max-w-md bg-card/90 shadow-lg shadow-primary/5 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Registrace</CardTitle>
        <CardDescription>
          Nejdřív zvolte firmu nebo uživatele (kód firmy, IBAN). Pak dokončete
          přes Apple nebo e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
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

          <Button
            type="submit"
            size="lg"
            className="w-full bg-black text-white hover:bg-black/85"
            formAction={appleAction}
            loading={applePending}
            disabled={pending}
          >
            <AppleLogo className="size-4" />
            Dokončit přes Apple
          </Button>

          <div className="relative py-1 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-card px-2">nebo e-mailem</span>
            <span
              aria-hidden
              className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
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
              minLength={6}
              autoComplete="new-password"
              placeholder="min. 6 znaků"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            formAction={emailAction}
            loading={emailPending}
            disabled={pending}
          >
            {accountType === "company" ? "Založit firmu" : "Připojit se k firmě"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
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
