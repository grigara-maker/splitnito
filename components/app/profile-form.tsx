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
  dailyEmailReminders,
  inviteCode,
  companyName,
}: {
  name: string;
  iban: string | null;
  dailyEmailReminders: boolean;
  inviteCode: string;
  companyName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initial
  );

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

        <div className="flex flex-col gap-2">
          <Label htmlFor="dailyEmailReminders">E-mailové upomínky</Label>
          <label
            htmlFor="dailyEmailReminders"
            className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/5"
          >
            <input
              id="dailyEmailReminders"
              type="checkbox"
              name="dailyEmailReminders"
              defaultChecked={dailyEmailReminders}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium leading-snug">
                Denní upomínky na platbu a potvrzení
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                Po uzavření akce vždy přijde e-mail s QR kódem. Když je tahle
                volba zapnutá, Splitnito připomíná každých 24 hodin. Po sedmi
                dnech přijde jedna upomínka vždy — tu vypnout nelze.
              </span>
            </span>
          </label>
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
        <Button type="submit" loading={pending} className="w-fit">
          Uložit profil
        </Button>
      </form>

      <DeleteAccountForm mode="member" />
    </div>
  );
}
