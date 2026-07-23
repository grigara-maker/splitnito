/** Detekce duplicitních dokladů: stejný dodavatel + částka + datum. */

export type ReceiptDuplicateKey = {
  id?: string;
  vendor: string;
  totalAmount: number;
  purchasedAt: string | null;
  createdAt?: string;
};

export function normalizeVendor(vendor: string): string {
  return vendor.trim().toLowerCase().replace(/\s+/g, " ");
}

export function receiptDateKey(
  purchasedAt: string | null | undefined,
  createdAt?: string | null
): string | null {
  const raw = purchasedAt || createdAt;
  if (!raw) return null;

  // datetime-local / date bez timezone — bereme zapsaný kalendářní den
  if (
    /^\d{4}-\d{2}-\d{2}/.test(raw) &&
    !/Z$/i.test(raw) &&
    !/[+-]\d{2}:\d{2}$/.test(raw)
  ) {
    return raw.slice(0, 10);
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function roundAmount(amount: number): number {
  return Math.round(Number(amount) * 100) / 100;
}

export function receiptFingerprint(r: ReceiptDuplicateKey): string | null {
  const vendor = normalizeVendor(r.vendor);
  const date = receiptDateKey(r.purchasedAt, r.createdAt);
  if (!vendor || date == null) return null;
  if (!Number.isFinite(r.totalAmount)) return null;
  return `${vendor}|${roundAmount(r.totalAmount).toFixed(2)}|${date}`;
}

/** ID dokladů, které mají alespoň jednoho dalšího se stejným fingerprintem. */
export function findDuplicateReceiptIds(
  receipts: ReceiptDuplicateKey[]
): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const r of receipts) {
    if (!r.id) continue;
    const fp = receiptFingerprint(r);
    if (!fp) continue;
    const list = byKey.get(fp) ?? [];
    list.push(r.id);
    byKey.set(fp, list);
  }

  const duplicates = new Set<string>();
  for (const ids of byKey.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) duplicates.add(id);
  }
  return duplicates;
}

/** Najde existující doklad se stejným dodavatelem, částkou a datem (jiný než excludeId). */
export function findMatchingReceipt(
  candidate: ReceiptDuplicateKey,
  existing: ReceiptDuplicateKey[],
  excludeId?: string
): ReceiptDuplicateKey | null {
  const fp = receiptFingerprint(candidate);
  if (!fp) return null;
  for (const r of existing) {
    if (excludeId && r.id === excludeId) continue;
    if (receiptFingerprint(r) === fp) return r;
  }
  return null;
}
