"use client";

import { useMemo, useState } from "react";

import { formatCzk } from "@/lib/iban";
import {
  normalizeReceiptItems,
  type ReceiptItem,
} from "@/lib/types/database";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ReceiptRow = {
  id: string;
  vendor: string;
  total_amount: number;
  created_at: string;
  image_url: string | null;
  user_id: string;
  items?: unknown;
  profiles: { name: string } | { name: string }[] | null;
};

function profileName(
  profiles: ReceiptRow["profiles"]
): string {
  if (Array.isArray(profiles)) return profiles[0]?.name ?? "Neznámý";
  return profiles?.name ?? "Neznámý";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function ReceiptsOverview({ receipts }: { receipts: ReceiptRow[] }) {
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ReceiptRow | null>(null);

  const vendors = useMemo(() => {
    const set = new Set(receipts.map((r) => r.vendor));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [receipts]);

  const filtered = useMemo(() => {
    if (vendorFilter === "all") return receipts;
    return receipts.filter((r) => r.vendor === vendorFilter);
  }, [receipts, vendorFilter]);

  const total = filtered.reduce((s, r) => s + Number(r.total_amount), 0);

  const byUser = useMemo(() => {
    const map = new Map<
      string,
      { name: string; items: ReceiptRow[]; sum: number }
    >();
    for (const r of filtered) {
      const entry = map.get(r.user_id) ?? {
        name: profileName(r.profiles),
        items: [],
        sum: 0,
      };
      entry.items.push(r);
      entry.sum += Number(r.total_amount);
      map.set(r.user_id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [filtered]);

  const selectedItems: ReceiptItem[] = selected
    ? normalizeReceiptItems(selected.items)
    : [];
  const selectedWhen = selected ? formatDateTime(selected.created_at) : null;

  if (receipts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Zatím žádné doklady. Přidejte první níže.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Zobrazená útrata</p>
          <p className="text-3xl font-semibold tracking-tight">
            {formatCzk(total)}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="vendor-filter"
            className="text-xs text-muted-foreground"
          >
            Filtr dodavatel
          </label>
          <select
            id="vendor-filter"
            className="h-8 min-w-44 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
          >
            <option value="all">Všichni dodavatelé</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {byUser.map((group) => (
          <div
            key={group.name + group.sum}
            className="rounded-xl bg-card ring-1 ring-foreground/10"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="font-medium">{group.name}</p>
              <Badge variant="secondary">{formatCzk(group.sum)}</Badge>
            </div>
            <ul className="divide-y divide-border/50">
              {group.items.map((r) => {
                const when = formatDateTime(r.created_at);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm transition hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{r.vendor}</p>
                        <p className="text-muted-foreground">
                          {when.date} · {when.time}
                        </p>
                      </div>
                      <span className="font-medium">
                        {formatCzk(Number(r.total_amount))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          {selected && selectedWhen ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.vendor}</DialogTitle>
                <DialogDescription>
                  Detail dokladu · {profileName(selected.profiles)}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Datum</dt>
                  <dd className="font-medium">{selectedWhen.date}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Čas</dt>
                  <dd className="font-medium">{selectedWhen.time}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dodavatel</dt>
                  <dd className="font-medium">{selected.vendor}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Celkem</dt>
                  <dd className="font-medium">
                    {formatCzk(Number(selected.total_amount))}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="mb-2 text-sm font-medium">Položky</p>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Bez rozpisu položek.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Název</th>
                          <th className="px-3 py-2 font-medium text-right">
                            Počet
                          </th>
                          <th className="px-3 py-2 font-medium text-right">
                            Cena / ks
                          </th>
                          <th className="px-3 py-2 font-medium text-right">
                            Celkem
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {selectedItems.map((item, idx) => (
                          <tr key={`${item.name}-${idx}`}>
                            <td className="px-3 py-2">{item.name}</td>
                            <td className="px-3 py-2 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatCzk(item.unitPrice)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCzk(item.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selected.image_url ? (
                <a
                  href={selected.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Otevřít fotku účtenky
                </a>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
