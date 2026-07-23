"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";

import {
  confirmPaymentAction,
  reopenEventAction,
} from "@/lib/actions/events";
import { buildSpayd } from "@/lib/spayd";
import { formatCzk } from "@/lib/iban";
import type { SettlementSummary, SettlementTransfer } from "@/lib/settlement";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SettlementView({
  summary,
  currentUserId,
  eventId,
  canReopen,
  companyName,
  eventName,
}: {
  summary: SettlementSummary;
  currentUserId: string;
  eventId: string;
  canReopen: boolean;
  companyName: string;
  eventName: string;
}) {
  const paymentMessage = `splitnito - ${companyName} - ${eventName}`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={summary.allPaid ? "secondary" : "outline"}>
          {summary.allPaid ? "Hotovo — vše zaplaceno" : "Čeká se na platby"}
        </Badge>
        {canReopen && !summary.allPaid ? (
          <Button
            variant="outline"
            size="sm"
            loading={pending}
            onClick={() => {
              if (
                !confirm(
                  "Znovu otevřít akci? Doklady půjde znovu upravovat a vyúčtování se smaže."
                )
              ) {
                return;
              }
              startTransition(async () => {
                const result = await reopenEventAction(eventId);
                if (result.error) setError(result.error);
                else router.refresh();
              });
            }}
          >
            Obnovit akci
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Celkem výdaje" value={formatCzk(summary.totalExpenses)} />
        <Stat label="Celkem tržby" value={formatCzk(summary.totalRevenues)} />
        <Stat
          label="Do vyúčtování"
          value={formatCzk(summary.totalAmount)}
        />
        <Stat label="Stejný podíl" value={formatCzk(summary.averageShare)} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Přehled uživatelů
        </h3>
        <ul className="divide-y divide-border/70 rounded-xl bg-card ring-1 ring-foreground/10">
          {summary.members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {m.name}
                  {m.userId === currentUserId ? " (vy)" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Výdaje {formatCzk(m.expenses)}
                  {m.revenues > 0.005
                    ? ` · tržby ${formatCzk(m.revenues)}`
                    : ""}
                  {" → "}
                  {formatCzk(m.paid)}
                </p>
              </div>
              <p
                className={
                  m.balance > 0.005
                    ? "text-sm font-medium text-emerald-700"
                    : m.balance < -0.005
                      ? "text-sm font-medium text-destructive"
                      : "text-sm text-muted-foreground"
                }
              >
                {m.balance > 0.005
                  ? `+${formatCzk(m.balance)}`
                  : m.balance < -0.005
                    ? formatCzk(m.balance)
                    : "Vyrovnáno"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Platby
        </h3>
        {summary.transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Všichni jsou vyrovnaní — žádné platby nejsou potřeba.
          </p>
        ) : (
          <ul className="grid gap-4">
            {summary.transfers.map((t) => (
              <TransferCard
                key={t.id}
                transfer={t}
                currentUserId={currentUserId}
                eventId={eventId}
                paymentMessage={paymentMessage}
                onChanged={() => router.refresh()}
              />
            ))}
          </ul>
        )}
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TransferCard({
  transfer,
  currentUserId,
  eventId,
  paymentMessage,
  onChanged,
}: {
  transfer: SettlementTransfer;
  currentUserId: string;
  eventId: string;
  paymentMessage: string;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isDebtor = transfer.fromUserId === currentUserId;
  const isCreditor = transfer.toUserId === currentUserId;
  const confirmed = transfer.status === "confirmed";
  const showQr =
    !confirmed && (isDebtor || isCreditor) && Boolean(transfer.toIban);

  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {transfer.fromName} → {transfer.toName}: {formatCzk(transfer.amount)}
        </p>
        <Badge variant={confirmed ? "secondary" : "outline"}>
          {confirmed ? "Hotovo" : "Čeká na platbu"}
        </Badge>
      </div>

      {confirmed ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Platba byla potvrzena.
        </p>
      ) : showQr ? (
        <>
          <PaymentQr
            iban={transfer.toIban!}
            amount={transfer.amount}
            recipientName={transfer.toName}
            message={paymentMessage}
          />
          {isCreditor ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Po přijetí platby potvrďte zaplacení.
              </p>
              <Button
                loading={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await confirmPaymentAction(
                      eventId,
                      transfer.id
                    );
                    if (result.error) setError(result.error);
                    else onChanged();
                  });
                }}
              >
                Potvrdit zaplacení
              </Button>
            </div>
          ) : null}
        </>
      ) : isDebtor || isCreditor ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Příjemce nemá vyplněný IBAN — doplňte ho v profilu.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Platba mezi ostatními členy.
        </p>
      )}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function PaymentQr({
  iban,
  amount,
  recipientName,
  message,
}: {
  iban: string;
  amount: number;
  recipientName: string;
  message: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const spayd = buildSpayd({ iban, amount, recipientName, message });

  useEffect(() => {
    void QRCode.toDataURL(spayd, { width: 200, margin: 1 }).then(setDataUrl);
  }, [spayd]);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-accent/40 p-3 sm:flex-row sm:items-center">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="QR platba"
          className="size-40 rounded-lg bg-white p-2 ring-1 ring-border"
        />
      ) : (
        <div className="size-40 animate-pulse rounded-lg bg-muted" />
      )}
      <div className="text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">
          Naskenujte QR v bankovní aplikaci.
        </p>
        <p className="font-mono text-xs break-all">{iban}</p>
        <p className="mt-1">{formatCzk(amount)}</p>
        <p className="mt-2 text-xs">
          Zpráva: <span className="text-foreground">{message}</span>
        </p>
      </div>
    </div>
  );
}
