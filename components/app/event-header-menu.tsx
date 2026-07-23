"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteEventAction } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EventHeaderMenu({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await deleteEventAction(eventId);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Smazání se nezdařilo. Zkuste to znovu.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex max-w-[14rem] flex-col items-end gap-2 sm:max-w-xs">
        <p className="text-right text-xs text-muted-foreground sm:text-sm">
          Opravdu smazat „{eventName}“? Smažou se doklady, tržby i vyúčtování.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={loading}
            onClick={() => void handleDelete()}
          >
            Ano, smazat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
          <p className="text-right text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            aria-label="Menu akce"
          />
        }
      >
        <Menu className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 w-auto">
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Smazat akci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
