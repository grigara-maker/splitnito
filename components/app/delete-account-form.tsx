"use client";

import { useActionState } from "react";

import { deleteAccountAction, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthState = {};

export function DeleteAccountForm({
  mode,
  companyName,
}: {
  mode: "member" | "company";
  companyName?: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initial
  );

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <h3 className="font-medium text-destructive">
        {mode === "company" ? "Smazat firmu" : "Smazat účet"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "company" ? (
          <>
            Trvale smaže firmu, <strong>všechny uživatelské účty</strong>, akce,
            doklady i nahrané soubory. E-maily firmy i uživatelů půjde znovu
            zaregistrovat. Tuto akci nelze vrátit.
          </>
        ) : (
          <>
            Smaže váš účet a přihlášení. Doklady a fotky, které jste nahráli,
            zůstanou ve firmě (bez vazby na váš účet). Stejný e-mail půjde znovu
            použít při registraci.
          </>
        )}
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">
            {mode === "company"
              ? `Pro potvrzení napište název firmy: ${companyName ?? ""}`
              : "Pro potvrzení napište SMAZAT"}
          </Label>
          <Input
            id="confirm"
            name="confirm"
            required
            autoComplete="off"
            placeholder={mode === "company" ? companyName : "SMAZAT"}
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" variant="destructive" loading={pending}>
          {mode === "company" ? "Trvale smazat firmu" : "Trvale smazat účet"}
        </Button>
      </form>
    </div>
  );
}
