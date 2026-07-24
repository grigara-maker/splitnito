"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createReceiptAction,
  updateReceiptAction,
  type ActionState,
} from "@/lib/actions/events";
import { toDatetimeLocalInPrague } from "@/lib/datetime-prague";
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

function draftsToItems(items: DraftItem[]): ReceiptItem[] {
  return items
    .filter((item) => item.name.trim())
    .map((item) => {
      const quantity = Number(String(item.quantity).replace(",", ".")) || 1;
      const unitPrice = Number(String(item.unitPrice).replace(",", ".")) || 0;
      const totalPrice =
        Number(String(item.totalPrice).replace(",", ".")) ||
        quantity * unitPrice;
      return {
        name: item.name.trim(),
        quantity,
        unitPrice,
        totalPrice: Math.round(totalPrice * 100) / 100,
      };
    });
}

function toDatetimeLocalValue(d: Date): string {
  return toDatetimeLocalInPrague(d);
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
  const [totalAmount, setTotalAmount] = useState(
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
  const [items, setItems] = useState<DraftItem[]>(() =>
    toDraft(normalizeReceiptItems(initialReceipt?.items))
  );
  const [imageUrl, setImageUrl] = useState(initialReceipt?.imageUrl ?? "");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const computedItems = useMemo(() => draftsToItems(items), [items]);
  const itemsTotal = useMemo(() => itemsSum(computedItems), [computedItems]);

  const duplicateMatch = useMemo(() => {
    const amount = Number(String(totalAmount).replace(",", "."));
    if (!vendor.trim() || !Number.isFinite(amount) || amount < 0) return null;
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

  useEffect(() => {
    if (!totalManual && computedItems.length > 0) {
      setTotalAmount(String(itemsTotal));
    }
  }, [itemsTotal, computedItems.length, totalManual]);

  function resetCreateForm() {
    setVendor("");
    setTotalAmount("");
    setTotalManual(false);
    setPurchasedAt(toDatetimeLocalValue(new Date()));
    setItems([emptyItem()]);
    setImageUrl("");
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

  function removeItem(key: string) {
    setItems((prev) => {
      const next = prev.filter((row) => row.key !== key);
      const remaining = next.length > 0 ? next : [emptyItem()];
      const sum = itemsSum(draftsToItems(remaining));
      setTotalAmount(sum > 0 ? String(sum) : "0");
      setTotalManual(false);
      return remaining;
    });
  }

  function updateItem(
    key: string,
    field: keyof Omit<DraftItem, "key">,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const next = { ...item, [field]: value };

        if (field === "quantity" || field === "unitPrice") {
          const qty = Number(String(next.quantity).replace(",", "."));
          const unit = Number(String(next.unitPrice).replace(",", "."));
          if (Number.isFinite(qty) && Number.isFinite(unit) && qty > 0) {
            next.totalPrice = String(Math.round(qty * unit * 100) / 100);
          }
        }

        if (field === "totalPrice") {
          const qty = Number(String(next.quantity).replace(",", "."));
          const total = Number(String(next.totalPrice).replace(",", "."));
          if (Number.isFinite(qty) && qty > 0 && Number.isFinite(total)) {
            next.unitPrice = String(Math.round((total / qty) * 100) / 100);
          }
        }

        return next;
      })
    );
  }

  async function handleFile(file: File) {
    setUploadError(null);
    setOcrWarning(null);
    setOcrLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášeni.");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErrorDb } = await supabase.storage
        .from("receipts")
        .upload(path, file, { upsert: false });

      if (uploadErrorDb) throw new Error(uploadErrorDb.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(path);
      setImageUrl(publicUrl);

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        setOcrWarning(
          json.error ??
            "OCR se nepodařilo. Doklad můžete vyplnit ručně a uložit."
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
        // Celková částka se drží souču položek — smazání/úprava je automaticky propsíše
        setTotalManual(false);
        const sum = itemsSum(draftsToItems(draftItems));
        if (sum > 0) {
          setTotalAmount(String(sum));
        } else if (json.totalAmount != null) {
          setTotalAmount(String(json.totalAmount));
        }
      } else if (json.totalAmount != null) {
        setTotalAmount(String(json.totalAmount));
        setTotalManual(true);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Nahrání selhalo");
    } finally {
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
            loading={ocrLoading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            Vyfotit / nahrát účtenku
          </Button>
          {imageUrl ? (
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

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="purchasedAt">Datum a čas nákupu</Label>
          <Input
            id="purchasedAt"
            name="purchasedAt"
            type="datetime-local"
            required
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            className="w-full min-w-0 max-w-full box-border"
          />
        </div>
      </div>

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
            setTotalAmount(e.target.value);
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
            <div
              key={item.key}
              className="grid gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/5 sm:grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_auto]"
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Název {index + 1}
                </span>
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(item.key, "name", e.target.value)}
                  placeholder="Káva"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Počet</span>
                <Input
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(item.key, "quantity", e.target.value)
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Cena / ks</span>
                <Input
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(item.key, "unitPrice", e.target.value)
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Cena celkem</span>
                <Input
                  inputMode="decimal"
                  value={item.totalPrice}
                  onChange={(e) =>
                    updateItem(item.key, "totalPrice", e.target.value)
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Odstranit položku"
                  disabled={items.length <= 1 && !items[0]?.name.trim()}
                  onClick={() => removeItem(item.key)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
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

      <Button type="submit" loading={pending || ocrLoading}>
        {isEdit ? "Uložit změny" : "Uložit doklad"}
      </Button>
    </form>
  );
}
