"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";

import {
  submitPublicPaymentAction,
  type PublicPaymentView,
} from "@/lib/actions/public-payment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCzk } from "@/lib/iban";

export function PublicPaymentCard({ view }: { view: PublicPaymentView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isPay = view.action === "pay";
  const finished = done != null || view.alreadyDone;

  const title = isPay
    ? "Potvrzení odeslané platby"
    : "Potvrzení přijaté platby";

  const doneTitle = isPay
    ? "Platba je označená jako odeslaná"
    : "Přijetí platby je potvrzené";

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitPublicPaymentAction(view.token);
      if (result.error) setError(result.error);
      else setDone(result.success ?? "Hotovo.");
    });
  }

  return (
    <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {finished ? doneTitle : title}
        </h1>
        <Badge variant={finished ? "secondary" : "outline"}>
          {view.transfer.status === "confirmed"
            ? "Přijato"
            : view.transfer.status === "sent"
              ? "Odesláno"
              : "Čeká na platbu"}
        </Badge>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {view.eventName} · {view.companyName}
      </p>

      <div className="mt-5 rounded-xl bg-accent/40 px-4 py-5 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {isPay ? "K úhradě" : "Přijatá částka"}
        </p>
        <p className="mt-1 font-heading text-3xl font-semibold text-primary">
          {formatCzk(view.transfer.amount)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPay
            ? `Příjemce: ${view.transfer.toName}`
            : `Od: ${view.transfer.fromName}`}
        </p>
      </div>

      {isPay && !finished ? (
        <PaymentQr spayd={view.spayd} view={view} />
      ) : null}

      {done ? (
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>{done}</p>
        </div>
      ) : view.alreadyDone ? (
        <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {isPay
            ? "Tuhle platbu jste už označili jako odeslanou. Čeká se na potvrzení příjemce."
            : "Přijetí této platby je už potvrzené. Nemusíte nic dělat."}
        </p>
      ) : view.blockedReason ? (
        <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {view.blockedReason}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <Button className="w-full" loading={pending} onClick={submit}>
            {isPay ? "Zaplaceno — označit platbu" : "Peníze dorazily — potvrdit"}
          </Button>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <Link
        href={`/events/${view.eventId}`}
        className="mt-5 block text-center text-sm font-medium text-primary underline underline-offset-4"
      >
        Otevřít akci ve Splitnito
      </Link>
    </div>
  );
}

function PaymentQr({
  spayd,
  view,
}: {
  spayd: string | null;
  view: PublicPaymentView;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!spayd) return;
    let active = true;
    void QRCode.toDataURL(spayd, { width: 320, margin: 1 })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [spayd]);

  if (!spayd) {
    return (
      <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        Příjemce nemá vyplněný IBAN, takže QR kód nelze vytvořit. Domluvte se na
        platbě napřímo.
      </p>
    );
  }

  return (
    <div className="mt-5 flex flex-col items-center gap-3 rounded-xl bg-accent/40 p-4">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="QR platba"
          className="size-48 rounded-lg bg-white p-2 ring-1 ring-border"
        />
      ) : failed ? (
        <div className="flex size-48 items-center justify-center rounded-lg bg-muted p-3 text-center text-xs text-destructive">
          QR kód se nepodařilo vytvořit.
        </div>
      ) : (
        <div className="size-48 animate-pulse rounded-lg bg-muted" />
      )}
      <div className="text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Naskenujte QR v bankovní aplikaci.
        </p>
        <p className="mt-1 font-mono text-xs break-all">
          {view.transfer.toIban}
        </p>
        <p className="mt-1 text-xs">Zpráva: {view.paymentMessage}</p>
      </div>
    </div>
  );
}
