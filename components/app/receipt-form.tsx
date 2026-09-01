"use client";

import {
  memo,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Plus, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThinkingOrb } from "thinking-orbs";

import {
  createReceiptAction,
  updateReceiptAction,
  type ActionState,
} from "@/lib/actions/events";
import { toDatetimeLocalInPrague } from "@/lib/datetime-prague";
import { OCR_MAX_BYTES, prepareReceiptFile } from "@/lib/image-compress";
import {
  findMatchingReceipt,
  type ReceiptDuplicateKey,
} from "@/lib/receipt-duplicates";
import { createClient } from "@/lib/supabase/client";
import { itemsSum } from "@/lib/settlement";
import type { ReceiptItem } from "@/lib/types/database";
import { normalizeReceiptItems } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

function ReceiptAnalysisStatus({ active }: { active: boolean }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <>
      <ThinkingOrb
        state="solving"
        size={64}
        paused={!active}
        aria-hidden
        className="shrink-0"
        style={{ width: 24, height: 24 }}
      />
      <span>Analyzuji doklad</span>
      <span
        aria-hidden
        className="border-l border-border pl-1.5 tabular-nums text-muted-foreground"
      >
        {elapsedSeconds} s
      </span>
    </>
  );
}

type DraftItem = {
  key: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type ReceiptFormInitial = {
  id: string;
  vendor: string;
  totalAmount: number;
  purchasedAt: string | null;
  imageUrl: string | null;
  items?: unknown;
};

/**
 * Vlastní komponenta s memo: u dlouhé účtenky jinak každý stisk klávesy
 * překresloval všechny řádky, což na mobilu znatelně sekalo.
 */
const ItemRow = memo(function ItemRow({
  item,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  canRemove: boolean;
  onChange: (
    key: string,
    field: keyof Omit<DraftItem, "key">,
    value: string
  ) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/5 sm:grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_auto]">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Název {index + 1}</span>
        <Input
          value={item.name}
          onChange={(e) => onChange(item.key, "name", e.target.value)}
          placeholder="Káva"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Počet</span>
        <Input
          inputMode="decimal"
          value={item.quantity}
          onChange={(e) => onChange(item.key, "quantity", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Cena / ks</span>
        <Input
          inputMode="decimal"
          value={item.unitPrice}
          onChange={(e) => onChange(item.key, "unitPrice", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Cena celkem</span>
        <Input
          inputMode="decimal"
          value={item.totalPrice}
          onChange={(e) => onChange(item.key, "totalPrice", e.target.value)}
        />
      </div>
      <div className="flex items-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Odstranit položku"
          disabled={!canRemove}
          onClick={() => onRemove(item.key)}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
});

function emptyItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    name: "",
    quantity: "1",
    unitPrice: "",
    totalPrice: "",
  };
}

function toDraft(items: ReceiptItem[]): DraftItem[] {
  if (items.length === 0) return [emptyItem()];
  return items.map((item) => ({
    key: crypto.randomUUID(),
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    totalPrice: String(item.totalPrice),
  }));
}

function parseDraftDecimal(raw: string, fallback: number): number {
  const cleaned = String(raw).trim().replace(",", ".");
  if (!cleaned || cleaned === "-" || cleaned === "+") return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function draftsToItems(items: DraftItem[]): ReceiptItem[] {
  return items
    .filter((item) => item.name.trim())
    .map((item) => {
      const quantity = parseDraftDecimal(item.quantity, 1);
      const qty = quantity > 0 ? quantity : 1;
      const unitPrice = parseDraftDecimal(item.unitPrice, 0);
      const totalParsed = parseDraftDecimal(item.totalPrice, Number.NaN);
      const totalPrice = Number.isFinite(totalParsed)
        ? totalParsed
        : Math.round(qty * unitPrice * 100) / 100;
      return {
        name: item.name.trim(),
        quantity: qty,
        unitPrice,
        totalPrice: Math.round(totalPrice * 100) / 100,
      };
    });
}

function toDatetimeLocalValue(d: Date): string {
  return toDatetimeLocalInPrague(d);
}

function splitDatetimeLocal(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function joinDatetimeLocal(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "12:00"}`;
}

export function ReceiptForm({
  eventId,
  initialReceipt,
  existingReceipts = [],
  onSaved,
}: {
  eventId: string;
  initialReceipt?: ReceiptFormInitial;
  /** Doklady akce pro detekci duplicit (dodavatel + částka + datum). */
  existingReceipts?: ReceiptDuplicateKey[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(initialReceipt);
  const action = isEdit ? updateReceiptAction : createReceiptAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [vendor, setVendor] = useState(initialReceipt?.vendor ?? "");
  // Ručně zadaná částka. Dokud ji uživatel nepřepíše, řídí se součtem položek.
  const [manualTotal, setManualTotal] = useState(
    initialReceipt ? String(initialReceipt.totalAmount) : ""
  );
  const [totalManual, setTotalManual] = useState(Boolean(initialReceipt));
  const [purchasedAt, setPurchasedAt] = useState(() => {
    if (initialReceipt?.purchasedAt) {
      const v = toDatetimeLocalInPrague(initialReceipt.purchasedAt);
      if (v) return v;
    }
    return toDatetimeLocalValue(new Date());
  });
  const purchaseParts = splitDatetimeLocal(purchasedAt);

  function setPurchaseDate(date: string) {
    setPurchasedAt(joinDatetimeLocal(date, purchaseParts.time));
  }

  function setPurchaseTime(time: string) {
    setPurchasedAt(joinDatetimeLocal(purchaseParts.date, time));
  }
  const [items, setItems] = useState<DraftItem[]>(() =>
    toDraft(normalizeReceiptItems(initialReceipt?.items))
  );
  const [imageUrl, setImageUrl] = useState(initialReceipt?.imageUrl ?? "");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [analysisAnimationActive, setAnalysisAnimationActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const computedItems = useMemo(() => draftsToItems(items), [items]);
  const itemsTotal = useMemo(() => itemsSum(computedItems), [computedItems]);

  // Odvozeno při renderu, ne efektem — jinak každý stisk klávesy v položkách
  // vyvolal druhé překreslení celého formuláře.
  const totalAmount =
    !totalManual && computedItems.length > 0 ? String(itemsTotal) : manualTotal;

  const duplicateMatch = useMemo(() => {
    const amount = Number(String(totalAmount).replace(",", "."));
    if (!vendor.trim() || !Number.isFinite(amount)) return null;
    return findMatchingReceipt(
      {
        vendor,
        totalAmount: amount,
        purchasedAt: purchasedAt || null,
      },
      existingReceipts,
      initialReceipt?.id
    );
  }, [vendor, totalAmount, purchasedAt, existingReceipts, initialReceipt?.id]);

  function resetCreateForm() {
    setVendor("");
    setManualTotal("");
    setTotalManual(false);
    setPurchasedAt(toDatetimeLocalValue(new Date()));
    setItems([emptyItem()]);
    setImageUrl("");
    setImageUploading(false);
    setOcrWarning(null);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Po úspěšném uložení (create) vyčistit formulář — i při opakovaném uložení
  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;

    if (!finished || !state.success) return;

    if (!isEdit) {
      resetCreateForm();
      router.refresh();
    }
    onSaved?.();
  }, [pending, state.success, isEdit, onSaved, router]);

  // Stabilní identita, jinak by memo na řádcích nemělo smysl.
  const removeItem = useCallback((key: string) => {
    setTotalManual(false);
    setItems((prev) => {
      const next = prev.filter((row) => row.key !== key);
      return next.length > 0 ? next : [emptyItem()];
    });
  }, []);

  const updateItem = useCallback(
    (key: string, field: keyof Omit<DraftItem, "key">, value: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item;
          const next = { ...item, [field]: value };

          if (field === "quantity" || field === "unitPrice") {
            const qty = parseDraftDecimal(next.quantity, 1);
            const unit = parseDraftDecimal(next.unitPrice, Number.NaN);
            if (Number.isFinite(qty) && qty > 0 && Number.isFinite(unit)) {
              next.totalPrice = String(Math.round(qty * unit * 100) / 100);
            }
          }

          if (field === "totalPrice") {
            const qty = parseDraftDecimal(next.quantity, 1);
            const total = parseDraftDecimal(next.totalPrice, Number.NaN);
            if (Number.isFinite(qty) && qty > 0 && Number.isFinite(total)) {
              next.unitPrice = String(Math.round((total / qty) * 100) / 100);
            }
          }

          return next;
        })
      );
    },
    []
  );

  /** Záloha, když doklad neprojde přes OCR route (limit velikosti, výpadek). */
  async function uploadToStorage(file: File) {
    setImageUploading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new Error("Nejste přihlášeni.");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
      if (error) throw new Error(error.message);

      setImageUrl(
        supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl
      );
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Fotku se nepodařilo nahrát: ${err.message}`
          : "Fotku se nepodařilo nahrát."
      );
    } finally {
      setImageUploading(false);
    }
  }

  async function handleFile(file: File) {
    setUploadError(null);
    setOcrWarning(null);
    setAnalysisAnimationActive(false);
    setOcrLoading(true);
    try {
      const prepared = await prepareReceiptFile(file);
      // Orb se rozhýbe až po kompresi, když už běží jen síť.
      setAnalysisAnimationActive(true);

      // Nad limit serverless funkce by požadavek skončil na 413 ještě před
      // route handlerem — doklad tedy jen nahrajeme a necháme vyplnit ručně.
      if (prepared.size > OCR_MAX_BYTES) {
        await uploadToStorage(prepared);
        setOcrWarning(
          "Soubor je moc velký na automatické čtení. Doklad je nahraný — částku a položky prosím vyplňte ručně."
        );
        return;
      }

      // Surové tělo místo multipartu — méně bajtů i práce na obou stranách.
      // Route obrázek rovnou uloží do Storage, takže mobil posílá data jednou.
      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": prepared.type || "image/jpeg" },
        body: prepared,
      });

      // Chyby brány (413, 504) nevrací JSON.
      const json = await ocrRes
        .json()
        .catch(() => ({}) as { error?: string; imageUrl?: string });

      if (json.imageUrl) {
        setImageUrl(json.imageUrl);
      } else {
        await uploadToStorage(prepared);
      }

      if (!ocrRes.ok) {
        setOcrWarning(
          json.error ??
            (ocrRes.status === 413
              ? "Soubor je moc velký na automatické čtení. Doklad je nahraný — vyplňte ho prosím ručně."
              : "OCR se nepodařilo. Doklad můžete vyplnit ručně a uložit.")
        );
        return;
      }

      if (json.vendor) setVendor(json.vendor);
      if (json.purchasedAt) {
        const v = toDatetimeLocalInPrague(json.purchasedAt);
        if (v) setPurchasedAt(v);
      }
      if (Array.isArray(json.items) && json.items.length > 0) {
        const draftItems = toDraft(normalizeReceiptItems(json.items));
        setItems(draftItems);
        // Nulový součet položek → drž se celkové částky z dokladu.
        const sum = itemsSum(draftsToItems(draftItems));
        if (sum === 0 && json.totalAmount != null) {
          setManualTotal(String(json.totalAmount));
          setTotalManual(true);
        } else {
          setTotalManual(false);
        }
      } else if (json.totalAmount != null) {
        setManualTotal(String(json.totalAmount));
        setTotalManual(true);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Nahrání selhalo");
    } finally {
      setAnalysisAnimationActive(false);
      setOcrLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      {initialReceipt ? (
        <input type="hidden" name="receiptId" value={initialReceipt.id} />
      ) : null}
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="items" value={JSON.stringify(computedItems)} />

      <div className="flex flex-col gap-2">
        <Label>Fotka / soubor účtenky</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={ocrLoading}
            aria-busy={ocrLoading || undefined}
            aria-label={ocrLoading ? "Analyzuji doklad" : undefined}
            onClick={() => {
              // Výběr fotky trvá pár vteřin — mezitím naběhne funkce i TLS.
              void fetch("/api/ocr", { method: "GET" }).catch(() => {});
              fileRef.current?.click();
            }}
          >
            {ocrLoading ? (
              <ReceiptAnalysisStatus active={analysisAnimationActive} />
            ) : (
              <>
                <Upload />
                Vyfotit / nahrát účtenku
              </>
            )}
          </Button>
          {imageUploading ? (
            <span className="text-xs text-muted-foreground">
              Fotka se nahrává…
            </span>
          ) : imageUrl ? (
            <span className="text-xs text-muted-foreground">Obrázek nahrán</span>
          ) : null}
        </div>
        {uploadError ? (
          <p className="text-sm text-destructive">{uploadError}</p>
        ) : null}
        {ocrWarning ? (
          <p className="text-sm text-amber-700 dark:text-amber-500">{ocrWarning}</p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="vendor">Dodavatel</Label>
        <Input
          id="vendor"
          name="vendor"
          required
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Albert"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="purchaseDate">Datum nákupu</Label>
        <Input
          id="purchaseDate"
          type="date"
          required
          value={purchaseParts.date}
          onChange={(e) => setPurchaseDate(e.target.value)}
          className="receipt-date-input"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="purchaseTime">Čas nákupu</Label>
        <Input
          id="purchaseTime"
          type="time"
          required
          value={purchaseParts.time}
          onChange={(e) => setPurchaseTime(e.target.value)}
          className="receipt-date-input"
        />
      </div>
      <input type="hidden" name="purchasedAt" value={purchasedAt} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="totalAmount">Celková částka (Kč)</Label>
        <Input
          id="totalAmount"
          name="totalAmount"
          required
          inputMode="decimal"
          value={totalAmount}
          onChange={(e) => {
            setTotalManual(true);
            setManualTotal(e.target.value);
          }}
          placeholder="1250.50"
        />
        {computedItems.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Součet položek: {itemsTotal.toFixed(2)} Kč
            {!totalManual ? " (automaticky)" : ""}
          </p>
        ) : null}
      </div>

      {duplicateMatch ? (
        <p
          className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-400"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Duplikát — stejný dodavatel, částka i datum už ve firmě existuje
            {duplicateMatch.eventName
              ? ` (akce „${duplicateMatch.eventName}“)`
              : ""}
            {duplicateMatch.vendor ? `, „${duplicateMatch.vendor}“` : ""}.
            Uložte jen pokud jde opravdu o jiný doklad.
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Položky</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
          >
            <Plus />
            Přidat položku
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Po OCR můžete chybějící položky dopsat ručně. Při změně položek se
          přepočítá celková částka.
        </p>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <ItemRow
              key={item.key}
              item={item}
              index={index}
              canRemove={items.length > 1 || Boolean(items[0]?.name.trim())}
              onChange={updateItem}
              onRemove={removeItem}
            />
          ))}
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-primary" role="status">
          {state.success}
        </p>
      ) : null}

      {/* Uložení počká na dokončený upload, ať se doklad neuloží bez fotky. */}
      <Button type="submit" loading={pending || ocrLoading || imageUploading}>
        {isEdit ? "Uložit změny" : "Uložit doklad"}
      </Button>
    </form>
  );
}
