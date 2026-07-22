"use client";

import { useActionState } from "react";

import { removeMemberAction, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const initial: AuthState = {};

export function RemoveMemberButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeMemberAction,
    initial
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Odstranit uživatele ${name} z firmy?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="destructive" size="sm" loading={pending}>
        Odstranit
      </Button>
      {state.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="mt-1 text-xs text-primary">{state.success}</p>
      ) : null}
    </form>
  );
}
