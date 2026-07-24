"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { AlertTriangle, ChevronDown, Loader2, Search } from "lucide-react";
import Link from "next/link";

import {
  getArchiveReceiptDetailAction,
  getArchiveReceiptsAction,
  type ArchiveDateOrder,
  type ArchiveGroupBy,
  type ArchiveReceipt,
  type ArchiveReceiptDetail,
} from "@/lib/actions/archive";
import { getReceiptImageUrlAction } from "@/lib/actions/events";
import { formatCzk } from "@/lib/iban";
import {
  amountsMismatch,
  itemsSum,
} from "@/lib/settlement";
import { normalizeReceiptItems } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function receiptDayKey(r: ArchiveReceipt): string {
  const iso = r.purchased_at ?? r.created_at;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatReceiptWhen(r: ArchiveReceipt): string {
  const iso = r.purchased_at ?? r.created_at;
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
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

type Group = {
  key: string;
  label: string;
  total: number;
  rows: ArchiveReceipt[];
};

function buildGroups(
  rows: ArchiveReceipt[],
  groupBy: ArchiveGroupBy,
  dateOrder: ArchiveDateOrder
): Group[] {
  const map = new Map<string, ArchiveReceipt[]>();

  for (const r of rows) {
    let key: string;
    if (groupBy === "date") key = receiptDayKey(r);
    else if (groupBy === "vendor") key = r.vendor.trim() || "Bez dodavatele";
    else key = r.uploader_name?.trim() || "Bývalý uživatel";

    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }

  let keys = Array.from(map.keys());
  if (groupBy === "date") {
    keys.sort((a, b) =>
      dateOrder === "newest" ? b.localeCompare(a) : a.localeCompare(b)
    );
  } else {
    keys.sort((a, b) => a.localeCompare(b, "cs"));
  }

  return keys.map((key) => {
    const groupRows = map.get(key) ?? [];
    const total = groupRows.reduce((s, r) => s + r.total_amount, 0);
    return {
      key,
      label: groupBy === "date" ? formatDayLabel(key) : key,
      total,
      rows: groupRows,
    };
  });
}

export function ReceiptArchive() {
  const [groupBy, setGroupBy] = useState<ArchiveGroupBy>("date");
  const [dateOrder, setDateOrder] = useState<ArchiveDateOrder>("newest");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [rows, setRows] = useState<ArchiveReceipt[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchiveReceiptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const load = useCallback(
    async (opts: { offset: number; append: boolean }) => {
      const result = await getArchiveReceiptsAction({
        query: deferredQuery,
        groupBy,
        dateOrder,
        offset: opts.offset,
      });

      if (result.error) {
        setError(result.error);
        if (!opts.append) setRows([]);
        setHasMore(false);
        return;
      }

      setError(null);
      setRows((prev) =>
        opts.append ? [...prev, ...result.rows] : result.rows
      );
      setHasMore(result.hasMore);
    },
    [deferredQuery, groupBy, dateOrder]
  );

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setOpenGroups({});
    startTransition(() => {
      void (async () => {
        await load({ offset: 0, append: false });
        if (!cancelled) setInitialLoading(false);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const groups = useMemo(
    () => buildGroups(rows, groupBy, dateOrder),
    [rows, groupBy, dateOrder]
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      setImageUrl(null);
      setImageLoading(false);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setImageUrl(null);
    setImageLoading(true);

    void (async () => {
      const [detailResult, imageResult] = await Promise.all([
        getArchiveReceiptDetailAction(selectedId),
        getReceiptImageUrlAction(selectedId),
      ]);
      if (cancelled) return;

      if (detailResult.error || !detailResult.receipt) {
        setDetailError(detailResult.error ?? "Doklad nenalezen.");
        setDetail(null);
      } else {
        setDetail(detailResult.receipt);
      }
      setDetailLoading(false);
      setImageUrl(imageResult.url);
      setImageLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await load({ offset: rows.length, append: true });
    } finally {
      setLoadingMore(false);
    }
  }

  const selectedItems = detail ? normalizeReceiptItems(detail.items) : [];
  const purchaseWhen = detail
    ? formatDateTime(detail.purchased_at ?? detail.created_at)
    : null;
  const uploadedWhen = detail ? formatDateTime(detail.created_at) : null;
  const uploader =
    detail?.uploader_name?.trim() || "Bývalý uživatel";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat: dodavatel, částka (1500) nebo datum (1.7.2026)"
            className="pl-9"
            aria-label="Hledat v archivu dokladů"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["date", "Podle data"],
              ["vendor", "Podle dodavatele"],
              ["user", "Podle uživatele"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={groupBy === value ? "secondary" : "outline"}
              onClick={() => setGroupBy(value)}
            >
              {label}
            </Button>
          ))}
          {groupBy === "date" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() =>
                setDateOrder((o) => (o === "newest" ? "oldest" : "newest"))
              }
            >
              {dateOrder === "newest" ? "Nejnovější →" : "Nejstarší →"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {initialLoading || isPending ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Načítám archiv…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {deferredQuery
            ? "Žádné doklady neodpovídají hledání."
            : "Zatím žádné nahrané doklady."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Zobrazeno {rows.length}
            {hasMore ? "+" : ""} dokladů
            {deferredQuery ? ` pro „${deferredQuery}“` : ""}.
          </p>

          <ul className="flex flex-col gap-2">
            {groups.map((g) => {
              const open = openGroups[g.key] ?? false;
              return (
                <li
                  key={g.key}
                  className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [g.key]: !open,
                      }))
                    }
                    aria-expanded={open}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.rows.length}{" "}
                        {g.rows.length === 1
                          ? "doklad"
                          : g.rows.length < 5
                            ? "doklady"
                            : "dokladů"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCzk(g.total)}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {open ? (
                    <ul className="divide-y divide-border/60 border-t border-border/60">
                      {g.rows.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.vendor}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatReceiptWhen(r)}
                                {" · "}
                                {r.uploader_name?.trim() || "Bývalý uživatel"}
                                {" · "}
                                {r.event_name}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-medium tabular-nums">
                              {formatCzk(r.total_amount)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto sm:self-center"
              loading={loadingMore}
              onClick={() => void handleLoadMore()}
            >
              Načíst další
            </Button>
          ) : null}
        </div>
      )}

      <Dialog
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent
          className="max-w-[calc(100%-1.5rem)] sm:max-w-lg"
          showCloseButton
        >
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Načítám doklad…
            </div>
          ) : detailError ? (
            <p className="text-sm text-destructive" role="alert">
              {detailError}
            </p>
          ) : detail && purchaseWhen && uploadedWhen ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.vendor}</DialogTitle>
                <DialogDescription>
                  Detail dokladu · {uploader}
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
                  <dd className="font-medium break-words">{detail.vendor}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Akce</dt>
                  <dd className="font-medium break-words">{detail.event_name}</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-muted-foreground">Celkem</dt>
                  <dd className="flex flex-wrap items-center gap-2 font-medium">
                    {formatCzk(Number(detail.total_amount))}
                    {selectedItems.length > 0 &&
                    amountsMismatch(
                      itemsSum(selectedItems),
                      Number(detail.total_amount)
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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
                <Link
                  href={`/events/${detail.event_id}`}
                  prefetch={false}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Otevřít akci
                </Link>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
