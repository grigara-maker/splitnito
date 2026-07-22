"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { buildSpayd } from "@/lib/spayd";
import { formatCzk } from "@/lib/iban";
import type { SettlementSummary } from "@/lib/settlement";

export function SettlementView({
  summary,
  currentUserId,
}: {
  summary: SettlementSummary;
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Celkem utraceno" value={formatCzk(summary.totalAmount)} />
        <Stat label="Počet společníků" value={String(summary.memberCount)} />
        <Stat label="Průměr na osobu" value={formatCzk(summary.averageShare)} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Přehled členů
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
                  Zaplaceno {formatCzk(m.paid)}
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
            {summary.transfers.map((t, idx) => (
              <li
                key={`${t.fromUserId}-${t.toUserId}-${idx}`}
                className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              >
                <p className="font-medium">
                  {t.fromName} → {t.toName}: {formatCzk(t.amount)}
                </p>
                {t.toIban ? (
                  <PaymentQr
                    iban={t.toIban}
                    amount={t.amount}
                    recipientName={t.toName}
                    message={`Splitnito: ${t.fromName} → ${t.toName}`}
                    highlight={t.fromUserId === currentUserId}
                  />
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Příjemce nemá vyplněný IBAN — doplňte ho v profilu.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
  highlight,
}: {
  iban: string;
  amount: number;
  recipientName: string;
  message: string;
  highlight: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const spayd = buildSpayd({ iban, amount, recipientName, message });

  useEffect(() => {
    void QRCode.toDataURL(spayd, { width: 200, margin: 1 }).then(setDataUrl);
  }, [spayd]);

  return (
    <div
      className={`mt-3 flex flex-col gap-2 sm:flex-row sm:items-center ${highlight ? "rounded-lg bg-accent/40 p-3" : ""}`}
    >
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
        {highlight ? (
          <p className="mb-1 font-medium text-foreground">
            Toto je vaše platba — naskenujte QR v bankovní aplikaci.
          </p>
        ) : null}
        <p className="font-mono text-xs break-all">{iban}</p>
        <p className="mt-1">{formatCzk(amount)}</p>
      </div>
    </div>
  );
}
