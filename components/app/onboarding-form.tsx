"use client";

import { useActionState, useState } from "react";

import { completeOnboardingAction } from "@/lib/actions/onboarding";
import type { AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initial: AuthState = {};

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initial
  );
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Jméno</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultName ?? ""}
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
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "create" | "join")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Nová firma</TabsTrigger>
          <TabsTrigger value="join">Invite kód</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Název firmy</Label>
            <Input
              id="companyName"
              name="companyName"
              placeholder="Moje s.r.o."
              required={mode === "create"}
            />
          </div>
        </TabsContent>
        <TabsContent value="join" className="mt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="inviteCode">Invite kód</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              placeholder="ABCD1234"
              required={mode === "join"}
              className="uppercase"
            />
          </div>
        </TabsContent>
      </Tabs>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ukládám…" : "Pokračovat do Splitnito"}
      </Button>
    </form>
  );
}
