/** Detekce duplicitních dokladů: stejný dodavatel + částka + datum (v celé firmě). */

export type ReceiptDuplicateKey = {
  id?: string;
  vendor: string;
  totalAmount: number;
  purchasedAt: string | null;
  createdAt?: string | null;
  eventId?: string;
  eventName?: string;
};

/** Sjednocení názvu dodavatele (bez diakritiky, mezer, velikosti). */
export function normalizeVendor(vendor: string): string {
  return vendor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Kalendářní den nákupu (Europe/Prague).
 * datetime-local bere zapsané YYYY-MM-DD; ISO timestamp převádí do Prahy.
 */
export function receiptDateKey(
  purchasedAt: string | null | undefined,
  createdAt?: string | null
): string | null {
  const raw = (purchasedAt || createdAt || "").trim();
  if (!raw) return null;

  // datetime-local: "2024-07-23T14:30" — důvěřuj zapsanému dni
  const isDatetimeLocal =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) &&
    !/Z$/i.test(raw) &&
    !/[+-]\d{2}:\d{2}$/.test(raw);
  if (isDatetimeLocal) {
    return raw.slice(0, 10);
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function roundAmount(amount: number): number {
  return Math.round(Number(amount) * 100) / 100;
}

export function receiptFingerprint(r: ReceiptDuplicateKey): string | null {
  const vendor = normalizeVendor(r.vendor);
  const date = receiptDateKey(r.purchasedAt, r.createdAt);
  const amount = Number(r.totalAmount);
  if (!vendor || date == null || !Number.isFinite(amount)) return null;
  return `${vendor}|${roundAmount(amount).toFixed(2)}|${date}`;
}

/**
 * ID dokladů na stránce, které mají ve firmě (companyReceipts)
 * alespoň jednoho dalšího se stejným fingerprintem.
 */
export function findDuplicateReceiptIds(
  receiptsOnPage: ReceiptDuplicateKey[],
  companyReceipts: ReceiptDuplicateKey[] = receiptsOnPage
): Set<string> {
  const counts = new Map<string, number>();
  for (const r of companyReceipts) {
    const fp = receiptFingerprint(r);
    if (!fp) continue;
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }

  const duplicates = new Set<string>();
  for (const r of receiptsOnPage) {
    if (!r.id) continue;
    const fp = receiptFingerprint(r);
    if (fp && (counts.get(fp) ?? 0) >= 2) {
      duplicates.add(r.id);
    }
  }
  return duplicates;
}

/** Najde existující doklad se stejným dodavatelem, částkou a datem. */
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
