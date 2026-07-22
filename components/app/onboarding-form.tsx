"use client";

import { useActionState } from "react";

import { completeOnboardingAction } from "@/lib/actions/onboarding";
import type { AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <form action={formAction} className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="inviteCode">Kód firmy (volitelné)</Label>
        <Input
          id="inviteCode"
          name="inviteCode"
          placeholder="ABCD1234"
          className="uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Pokud se připojujete ke kolegům, zadejte jejich invite kód. Jinak se
          vytvoří vaše vlastní firma automaticky.
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
