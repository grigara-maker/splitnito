"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  deleteReceiptAction,
  getCompanyReceiptDuplicatesAction,
  getReceiptImageUrlAction,
} from "@/lib/actions/events";
import { formatCzk } from "@/lib/iban";
import {
  amountsMismatch,
  itemsSum,
} from "@/lib/settlement";
import {
  findDuplicateReceiptIds,
  type ReceiptDuplicateKey,
} from "@/lib/receipt-duplicates";
import { normalizeReceiptItems, type ReceiptItem } from "@/lib/types/database";
import { ReceiptForm } from "@/components/app/receipt-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ReceiptRow = {
  id: string;
  vendor: string;
  total_amount: number;
  created_at: string;
  purchased_at: string | null;
  image_url: string | null;
  user_id: string | null;
  uploader_name?: string | null;
  items?: unknown;
  profiles: { name: string } | { name: string }[] | null;
};

function profileName(profiles: ReceiptRow["profiles"]): string {
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

export function ReceiptsOverview({
  receipts,
  companyReceipts: initialCompanyReceipts,
  eventId,
  currentUserId,
  isCompanyAdmin,
  eventActive,
  loadCompanyDuplicates = false,
  showAddForm = false,
}: {
  receipts: ReceiptRow[];
  /** Doklady pro detekci duplicit (nejprve akce, pak firma). */
  companyReceipts: ReceiptDuplicateKey[];
  eventId: string;
  currentUserId: string;
  isCompanyAdmin: boolean;
  eventActive: boolean;
  /** Po mountu donačíst duplicity napříč firmou (neblokuje SSR). */
  loadCompanyDuplicates?: boolean;
  /** Formulář „Přidat doklad“ — hned pod celkovou částkou. */
  showAddForm?: boolean;
}) {
  const router = useRouter();
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ReceiptRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [companyReceipts, setCompanyReceipts] = useState(initialCompanyReceipts);

  const receiptSeedKey = useMemo(
    () =>
      initialCompanyReceipts
        .map((r) => r.id)
        .filter(Boolean)
        .sort()
        .join(","),
    [initialCompanyReceipts]
  );

  // Po refreshi (např. smazání) znovu načíst aktuální doklady firmy — smazané už nepočítat
  useEffect(() => {
    setCompanyReceipts(initialCompanyReceipts);
    if (!loadCompanyDuplicates) return;
    let cancelled = false;
    void getCompanyReceiptDuplicatesAction().then((rows) => {
      if (!cancelled) setCompanyReceipts(rows);
    });
    return () => {
      cancelled = true;
    };
    // receiptSeedKey = množina ID dokladů na stránce (mění se po smazání/přidání)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialCompanyReceipts sync přes seed
  }, [loadCompanyDuplicates, receiptSeedKey]);

  const addForm = showAddForm ? (
    <Card>
      <CardHeader>
        <CardTitle>Přidat doklad</CardTitle>
        <CardDescription>
          Vyplňte ručně, nebo nahrajte účtenku — OCR předvyplní dodavatele a
          částku.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReceiptForm eventId={eventId} existingReceipts={companyReceipts} />
      </CardContent>
    </Card>
  ) : null;

  useEffect(() => {
    if (!selected) {
      setImageUrl(null);
      setImageLoading(false);
      return;
    }
    if (selected.image_url) {
      setImageUrl(selected.image_url);
      return;
    }

    let cancelled = false;
    setImageUrl(null);
    setImageLoading(true);
    void getReceiptImageUrlAction(selected.id).then((result) => {
      if (cancelled) return;
      setImageUrl(result.url);
      setImageLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
      { key: string; name: string; items: ReceiptRow[]; sum: number }
    >();
    for (const r of filtered) {
      const key =
        r.user_id ?? `anon:${r.uploader_name ?? profileName(r.profiles)}`;
      const entry = map.get(key) ?? {
        key,
        name: profileName(r.profiles),
        items: [],
        sum: 0,
      };
      entry.items.push(r);
      entry.sum += Number(r.total_amount);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [filtered]);

  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(
    () => new Set()
  );

  function toggleUser(key: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const duplicateIds = useMemo(
    () =>
      findDuplicateReceiptIds(
        receipts.map((r) => ({
          id: r.id,
          vendor: r.vendor,
          totalAmount: Number(r.total_amount),
          purchasedAt: r.purchased_at,
          createdAt: r.created_at,
        })),
        companyReceipts
      ),
    [receipts, companyReceipts]
  );

  const selectedItems: ReceiptItem[] = selected
    ? normalizeReceiptItems(selected.items)
    : [];
  const purchaseWhen = selected
    ? formatDateTime(selected.purchased_at ?? selected.created_at)
    : null;
  const uploadedWhen = selected ? formatDateTime(selected.created_at) : null;
  const canManageSelected =
    selected &&
    eventActive &&
    ((selected.user_id != null && selected.user_id === currentUserId) ||
      isCompanyAdmin);

  if (receipts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Zobrazená útrata</p>
          <p className="text-3xl font-semibold tracking-tight">
            {formatCzk(0)}
          </p>
        </div>
        {addForm}
        <p className="text-sm text-muted-foreground">
          Zatím žádné doklady. Přidejte první výše.
        </p>
      </div>
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
          <label htmlFor="vendor-filter" className="text-xs text-muted-foreground">
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

      {addForm}

      <div className="flex flex-col gap-4">
        {byUser.map((group) => {
          const open = expandedUsers.has(group.key);
          return (
            <div
              key={group.key}
              className="rounded-xl bg-card ring-1 ring-foreground/10"
            >
              <button
                type="button"
                onClick={() => toggleUser(group.key)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                      open ? "rotate-0" : "-rotate-90"
                    )}
                    aria-hidden
                  />
                  <span className="truncate font-medium">{group.name}</span>
                </span>
                <Badge variant="secondary">{formatCzk(group.sum)}</Badge>
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <ul
                    className={cn(
                      "divide-y divide-border/50 border-t border-border/60",
                      !open && "pointer-events-none"
                    )}
                  >
                    {group.items.map((r) => {
                      const when = formatDateTime(
                        r.purchased_at ?? r.created_at
                      );
                      const lineItems = normalizeReceiptItems(r.items);
                      const mismatch =
                        lineItems.length > 0 &&
                        amountsMismatch(
                          itemsSum(lineItems),
                          Number(r.total_amount)
                        );
                      const isDuplicate = duplicateIds.has(r.id);
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setSelected(r);
                            }}
                            className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm transition hover:bg-muted/50"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {mismatch || isDuplicate ? (
                                <AlertTriangle
                                  className={
                                    isDuplicate
                                      ? "size-4 shrink-0 self-center text-amber-600"
                                      : "size-4 shrink-0 self-center text-destructive"
                                  }
                                  aria-label={
                                    isDuplicate
                                      ? "Možný duplikát"
                                      : "Nesedí součet položek"
                                  }
                                />
                              ) : null}
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium">{r.vendor}</p>
                                  <p className="text-muted-foreground">
                                    {when.date} · {when.time}
                                  </p>
                                </div>
                                {isDuplicate ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 self-center border-amber-600/40 text-amber-700"
                                  >
                                    duplikát
                                  </Badge>
                                ) : null}
                              </div>
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
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setEditing(false);
          }
        }}
      >
        <DialogContent
          className={
            editing
              ? "max-w-[calc(100%-1.5rem)] sm:max-w-2xl"
              : "max-w-[calc(100%-1.5rem)] sm:max-w-lg"
          }
          showCloseButton
        >
          {selected && purchaseWhen && uploadedWhen ? (
            editing && canManageSelected ? (
              <>
                <DialogHeader>
                  <DialogTitle>Upravit doklad</DialogTitle>
                  <DialogDescription>
                    {selected.vendor} · {profileName(selected.profiles)}
                  </DialogDescription>
                </DialogHeader>
                <ReceiptForm
                  eventId={eventId}
                  existingReceipts={companyReceipts}
                  initialReceipt={{
                    id: selected.id,
                    vendor: selected.vendor,
                    totalAmount: Number(selected.total_amount),
                    purchasedAt: selected.purchased_at,
                    imageUrl: imageUrl,
                    items: selected.items,
                  }}
                  onSaved={() => {
                    setEditing(false);
                    setSelected(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  <ArrowLeft />
                  Zpět na detail
                </Button>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    {selected.vendor}
                    {duplicateIds.has(selected.id) ? (
                      <Badge
                        variant="outline"
                        className="border-amber-600/40 text-amber-700"
                      >
                        <AlertTriangle className="size-3.5" />
                        duplikát
                      </Badge>
                    ) : null}
                  </DialogTitle>
                  <DialogDescription>
                    Detail dokladu · {profileName(selected.profiles)}
                  </DialogDescription>
                </DialogHeader>

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Datum nákupu</dt>
                    <dd className="font-medium">{purchaseWhen.date}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Čas nákupu</dt>
                    <dd className="font-medium">{purchaseWhen.time}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-muted-foreground">Nahráno do Splitnito</dt>
                    <dd className="font-medium break-words">
                      {uploadedWhen.date} · {uploadedWhen.time}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Dodavatel</dt>
                    <dd className="font-medium break-words">{selected.vendor}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-muted-foreground">Celkem</dt>
                    <dd className="flex flex-wrap items-center gap-2 font-medium">
                      {formatCzk(Number(selected.total_amount))}
                      {selectedItems.length > 0 &&
                      amountsMismatch(
                        itemsSum(selectedItems),
                        Number(selected.total_amount)
                      ) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          Součet položek nesedí
                        </span>
                      ) : null}
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
                    <>
                      {/* Mobil: stacked seznam */}
                      <ul className="divide-y divide-border/60 rounded-lg ring-1 ring-foreground/10 sm:hidden">
                        {selectedItems.map((item, idx) => (
                          <li
                            key={`${item.name}-${idx}`}
                            className="flex flex-col gap-1 px-3 py-3"
                          >
                            <p className="break-words font-medium leading-snug">
                              {item.name}
                            </p>
                            <div className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
                              <span className="shrink-0">
                                {item.quantity}× {formatCzk(item.unitPrice)}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatCzk(item.totalPrice)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>

                      {/* Desktop: tabulka */}
                      <div className="hidden overflow-x-auto rounded-lg ring-1 ring-foreground/10 sm:block">
                        <table className="w-full min-w-[28rem] text-left text-sm">
                          <thead className="bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Název</th>
                              <th className="px-3 py-2 text-right font-medium">
                                Počet
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Cena / ks
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Celkem
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {selectedItems.map((item, idx) => (
                              <tr key={`${item.name}-${idx}`}>
                                <td className="max-w-[12rem] px-3 py-2 break-words">
                                  {item.name}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {item.quantity}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                  {formatCzk(item.unitPrice)}
                                </td>
                                <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                                  {formatCzk(item.totalPrice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {imageUrl ? (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Zobrazit doklad
                  </a>
                ) : imageLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Načítám odkaz na doklad…
                  </p>
                ) : null}

                {actionError ? (
                  <p className="text-sm text-destructive">{actionError}</p>
                ) : null}

                <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft />
                    Zpět
                  </Button>
                  {canManageSelected ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil />
                        Upravit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        loading={pending}
                        onClick={() => {
                          if (!selected) return;
                          if (!confirm("Opravdu smazat tento doklad?")) return;
                          startTransition(async () => {
                            const deletedId = selected.id;
                            const result = await deleteReceiptAction(
                              deletedId,
                              eventId
                            );
                            if (result.error) {
                              setActionError(result.error);
                              return;
                            }
                            setCompanyReceipts((prev) =>
                              prev.filter((r) => r.id !== deletedId)
                            );
                            setSelected(null);
                            router.refresh();
                          });
                        }}
                      >
                        <Trash2 />
                        Smazat doklad
                      </Button>
                    </>
                  ) : null}
                </div>
              </>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
