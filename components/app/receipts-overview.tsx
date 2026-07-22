"use client";

import { useMemo, useState } from "react";

import { formatCzk } from "@/lib/iban";
import { Badge } from "@/components/ui/badge";

type ReceiptRow = {
  id: string;
  vendor: string;
  total_amount: number;
  created_at: string;
  image_url: string | null;
  user_id: string;
  profiles: { name: string } | { name: string }[] | null;
};

export function ReceiptsOverview({ receipts }: { receipts: ReceiptRow[] }) {
  const [vendorFilter, setVendorFilter] = useState<string>("all");

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
      const name = Array.isArray(r.profiles)
        ? r.profiles[0]?.name
        : r.profiles?.name;
      const entry = map.get(r.user_id) ?? {
        name: name ?? "Neznámý",
        items: [],
        sum: 0,
      };
      entry.items.push(r);
      entry.sum += Number(r.total_amount);
      map.set(r.user_id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [filtered]);

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
              {group.items.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.vendor}</p>
                    <p className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("cs-CZ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.image_url ? (
                      <a
                        href={r.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Účtenka
                      </a>
                    ) : null}
                    <span className="font-medium">
                      {formatCzk(Number(r.total_amount))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
