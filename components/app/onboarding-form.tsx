"use client";

import { useActionState, useState } from "react";

import { completeOnboardingAction } from "@/lib/actions/onboarding";
import type { AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initial: AuthState = {};

export function OnboardingForm({
  defaultName,
  defaultEmail,
  defaultInvite,
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultInvite?: string;
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initial
  );
  const [accountType, setAccountType] = useState<"company" | "member">(
    defaultInvite ? "member" : "company"
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="accountType" value={accountType} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          defaultValue={defaultEmail ?? ""}
          disabled
          readOnly
        />
      </div>

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
            Správce se jmenuje podle firmy. Doklady přidávají jen uživatelé.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Název firmy</Label>
            <Input
              id="companyName"
              name="companyName"
              placeholder="Moje s.r.o."
              required={accountType === "company"}
              defaultValue={defaultName ?? ""}
            />
          </div>
        </TabsContent>

        <TabsContent value="member" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Zadejte kód firmy — účet se k ní trvale přidruží.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Vaše jméno</Label>
            <Input
              id="name"
              name="name"
              required={accountType === "member"}
              defaultValue={defaultName ?? ""}
              placeholder="Jan Novák"
            />
          </div>
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
            <Label htmlFor="iban">IBAN (pro QR platby)</Label>
            <Input
              id="iban"
              name="iban"
              placeholder="CZ65 0800 0000 0012 3456 7890"
            />
            <p className="text-xs text-muted-foreground">
              Volitelné — doplníte později v profilu.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending}>
        Uložit účet a pokračovat
      </Button>
    </form>
  );
}
