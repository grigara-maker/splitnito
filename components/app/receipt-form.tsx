"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { createReceiptAction, type ActionState } from "@/lib/actions/events";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = {};

export function ReceiptForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(
    createReceiptAction,
    initial
  );
  const [vendor, setVendor] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [items, setItems] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        // Obrázek už je nahraný — OCR je jen pomocné předvyplnění
        setOcrWarning(
          json.error ??
            "OCR se nepodařilo. Doklad můžete vyplnit ručně a uložit."
        );
        return;
      }

      if (json.vendor) setVendor(json.vendor);
      if (json.totalAmount != null) setTotalAmount(String(json.totalAmount));
      if (Array.isArray(json.items) && json.items.length > 0) {
        setItems(
          json.items
            .map((item: { name?: string; amount?: number }) =>
              item.amount != null
                ? `${item.name ?? "Položka"} ${item.amount}`
                : (item.name ?? "")
            )
            .filter(Boolean)
            .join("\n")
        );
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Nahrání selhalo");
    } finally {
      setOcrLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="imageUrl" value={imageUrl} />

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="items">Položky (volitelné, jedna na řádek)</Label>
        <Textarea
          id="items"
          name="items"
          value={items}
          onChange={(e) => setItems(e.target.value)}
          placeholder={"Káva 89\nOběd 320"}
          rows={4}
        />
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
