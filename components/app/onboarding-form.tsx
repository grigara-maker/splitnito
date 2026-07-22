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
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initial
  );
  const [accountType, setAccountType] = useState<"company" | "member">(
    "company"
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Jméno a příjmení</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          placeholder="Jan Novák"
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
            Založíte profil firmy a získáte kód pro pozvání kolegů.
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
            Zadejte kód firmy — účet se k ní trvale přidruží.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inviteCode">Kód firmy</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              placeholder="ABCD1234"
              required={accountType === "member"}
              className="uppercase"
            />
          </div>
        </TabsContent>
      </Tabs>

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

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ukládám…" : "Uložit účet a pokračovat"}
      </Button>
    </form>
  );
}
