"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";

import { createReceiptAction, type ActionState } from "@/lib/actions/events";
import { createClient } from "@/lib/supabase/client";
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

export function ReceiptForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(
    createReceiptAction,
    initial
  );
  const [vendor, setVendor] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [imageUrl, setImageUrl] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      setVendor("");
      setTotalAmount("");
      setItems([emptyItem()]);
      setImageUrl("");
      setOcrWarning(null);
      setUploadError(null);
      formRef.current?.reset();
    }
  }, [state.success]);

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
      if (json.totalAmount != null) setTotalAmount(String(json.totalAmount));
      if (Array.isArray(json.items) && json.items.length > 0) {
        setItems(toDraft(normalizeReceiptItems(json.items)));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Nahrání selhalo");
    } finally {
      setOcrLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const itemsJson = JSON.stringify(
    items
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity: Number(String(item.quantity).replace(",", ".")) || 1,
        unitPrice: Number(String(item.unitPrice).replace(",", ".")) || 0,
        totalPrice:
          Number(String(item.totalPrice).replace(",", ".")) ||
          (Number(String(item.quantity).replace(",", ".")) || 1) *
            (Number(String(item.unitPrice).replace(",", ".")) || 0),
      }))
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <input type="hidden" name="items" value={itemsJson} />

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
            onClick={() => fileRef.current?.click()}
          >
            {ocrLoading ? <Loader2 className="animate-spin" /> : <Upload />}
            {ocrLoading ? "Zpracovávám…" : "Vyfotit / nahrát účtenku"}
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

      <div className="flex flex-col gap-2">
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="totalAmount">Celková částka (Kč)</Label>
        <Input
          id="totalAmount"
          name="totalAmount"
          required
          inputMode="decimal"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="1250.50"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Položky (volitelné)</Label>
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
                  placeholder="1"
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
                  placeholder="89"
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
                  placeholder="89"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Odstranit položku"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((prev) => prev.filter((row) => row.key !== item.key))
                  }
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

      <Button type="submit" disabled={pending || ocrLoading}>
        {pending ? "Ukládám…" : "Uložit doklad"}
      </Button>
    </form>
  );
}
