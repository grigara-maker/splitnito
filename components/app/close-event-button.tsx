"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { closeEventAction } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";

export function CloseEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClose() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await closeEventAction(eventId);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      } else {
        router.refresh();
      }
    } catch {
      setError("Uzavření se nezdařilo. Zkuste to znovu.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2 sm:items-end">
        <p className="text-sm text-muted-foreground sm:text-right">
          Opravdu uzavřít vyúčtování? Doklady se zamknou a vypočítají se platby.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            loading={loading}
            onClick={() => void handleClose()}
          >
            Ano, uzavřít
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => {
              if (loading) return;
              setConfirming(false);
              setError(null);
            }}
          >
            Zrušit
          </Button>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <Button
        type="button"
        variant="destructive"
        className="w-full touch-manipulation sm:w-auto"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Uzavřít vyúčtování
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
