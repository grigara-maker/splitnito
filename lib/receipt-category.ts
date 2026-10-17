export type ReceiptCategory = "expense" | "tax";

export function normalizeReceiptCategory(raw: unknown): ReceiptCategory {
  return raw === "tax" ? "tax" : "expense";
}
