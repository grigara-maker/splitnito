"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { closeEventAction } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";

export function CloseEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Opravdu uzavřít akci? Doklady už nepůjde upravovat a vypočítá se vyúčtování."
            )
          ) {
            return;
          }
          startTransition(async () => {
            const result = await closeEventAction(eventId);
            if (result.error) setError(result.error);
            else {
              setError(null);
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Uzavírám…" : "Uzavřít akci"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
