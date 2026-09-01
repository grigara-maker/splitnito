"use client";

import { Mail, MailX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  resendSettlementEmailsAction,
  setEventNotificationsAction,
} from "@/lib/actions/events";
import { Button } from "@/components/ui/button";

export function SettlementEmails({
  eventId,
  notifyEmails,
  emailAvailable,
  canManage,
  allPaid,
}: {
  eventId: string;
  notifyEmails: boolean;
  emailAvailable: boolean;
  canManage: boolean;
  allPaid: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!emailAvailable) return null;

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else {
        setMessage(result.success ?? null);
        router.refresh();
      }
    });
  }

  const Icon = notifyEmails ? Mail : MailX;

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">E-mailové notifikace</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {allPaid
                ? "Vyúčtování je vyrovnané — všem stranám odešel souhrn."
                : notifyEmails
                  ? "Účastníci dostali e-mail s QR kódem. Připomínku posíláme každých 24 hodin, dokud platbu nepotvrdí."
                  : "Notifikace k této akci jsou vypnuté — e-maily ani připomínky neodcházejí."}
            </p>
          </div>
        </div>

        {canManage && !allPaid ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {notifyEmails ? (
              <Button
                variant="outline"
                size="sm"
                loading={pending}
                onClick={() =>
                  run(() => resendSettlementEmailsAction(eventId))
                }
              >
                Rozeslat teď
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              loading={pending}
              onClick={() =>
                run(() => setEventNotificationsAction(eventId, !notifyEmails))
              }
            >
              {notifyEmails ? "Vypnout" : "Zapnout"}
            </Button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
