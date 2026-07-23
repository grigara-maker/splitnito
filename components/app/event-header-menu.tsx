"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  closeEventAction,
  deleteEventAction,
} from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ConfirmKind = "close" | "delete" | null;

export function EventHeaderMenu({
  eventId,
  eventName,
  canClose,
}: {
  eventId: string;
  eventName: string;
  canClose: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ConfirmKind>(null);
  const [loading, setLoading] = useState(false);

  function cancelConfirm() {
    if (loading) return;
    setConfirming(null);
    setError(null);
  }

  async function handleClose() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await closeEventAction(eventId);
      if (result.error) {
        setError(result.error);
        setConfirming(null);
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Uzavření se nezdařilo. Zkuste to znovu.");
      setConfirming(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await deleteEventAction(eventId);
      if (result.error) {
        setError(result.error);
        setConfirming(null);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Smazání se nezdařilo. Zkuste to znovu.");
      setConfirming(null);
    } finally {
      setLoading(false);
    }
  }

  if (confirming === "close") {
    return (
      <div className="flex max-w-[14rem] flex-col items-end gap-2 sm:max-w-xs">
        <p className="text-right text-xs text-muted-foreground sm:text-sm">
          Opravdu uzavřít vyúčtování? Doklady se zamknou a vypočítají se platby.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={loading}
            onClick={() => void handleClose()}
          >
            Ano, uzavřít
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={cancelConfirm}
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

  if (confirming === "delete") {
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
            onClick={cancelConfirm}
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
    <div className="flex flex-col items-end gap-1">
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
        <DropdownMenuContent align="end" className="min-w-44 w-auto">
          {canClose ? (
            <DropdownMenuItem
              onClick={() => {
                setError(null);
                setConfirming("close");
              }}
            >
              Uzavřít vyúčtování
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setError(null);
              setConfirming("delete");
            }}
          >
            Smazat akci
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p className="text-right text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
