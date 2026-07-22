"use client";

import { useActionState } from "react";

import { updateProfileAction, type AuthState } from "@/lib/actions/auth";
import { DeleteAccountForm } from "@/components/app/delete-account-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthState = {};

export function ProfileForm({
  name,
  iban,
  inviteCode,
  companyName,
  isCompanyAdmin,
}: {
  name: string;
  iban: string | null;
  inviteCode: string;
  companyName: string;
  isCompanyAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initial
  );

  if (isCompanyAdmin) {
    return (
      <div className="flex max-w-lg flex-col gap-8">
        <div className="rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/5">
          <p className="text-sm text-muted-foreground">Účet správce firmy</p>
          <p className="mt-1 font-medium">{companyName}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Invite kód pro kolegy
          </p>
          <p className="mt-1 font-mono text-lg tracking-wider">{inviteCode}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Název firmy upravíte v sekci Firma. IBAN a doklady mají jen
            uživatelé.
          </p>
        </div>
        <DeleteAccountForm mode="company" companyName={companyName} />
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div className="rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/5">
        <p className="text-sm text-muted-foreground">Firma</p>
        <p className="mt-1 font-medium">{companyName}</p>
        <p className="mt-3 text-sm text-muted-foreground">Invite kód</p>
        <p className="mt-1 font-mono text-lg tracking-wider">{inviteCode}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Jméno</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            name="iban"
            defaultValue={iban ?? ""}
            placeholder="CZ65 0800 0000 0012 3456 7890"
          />
          <p className="text-xs text-muted-foreground">
            IBAN slouží pro QR platby mezi uživateli při uzavření akce.
          </p>
        </div>
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-primary" role="status">
            {state.success}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Ukládám…" : "Uložit profil"}
        </Button>
      </form>

      <DeleteAccountForm mode="member" />
    </div>
  );
}
