"use client";

import { useActionState } from "react";

import { signInWithAppleAction, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

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

export function AppleAuthButton({
  next = "/dashboard",
  label = "Pokračovat s Apple",
}: {
  next?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(
    signInWithAppleAction,
    initial
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <Button
        type="submit"
        size="lg"
        className="w-full bg-black text-white hover:bg-black/85"
        loading={pending}
      >
        <AppleLogo className="size-4" />
        {label}
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
