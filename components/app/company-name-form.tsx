"use client";

import { useActionState } from "react";

import { updateCompanyNameAction, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthState = {};

export function CompanyNameForm({
  companyName,
  ico,
}: {
  companyName: string;
  ico: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateCompanyNameAction,
    initial
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="companyName">Název firmy</Label>
        <Input
          id="companyName"
          name="companyName"
          defaultValue={companyName}
          required
          placeholder="Moje s.r.o."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ico">IČO</Label>
        <Input
          id="ico"
          name="ico"
          defaultValue={ico ?? ""}
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="12345678"
          className="max-w-48"
        />
        {!ico ? (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Doplňte IČO firmy. Splitnito je určené podnikatelům, IČO ověříme v
            registru ARES.
          </p>
        ) : null}
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
        Uložit údaje firmy
      </Button>
    </form>
  );
}
