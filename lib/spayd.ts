import { normalizeIban } from "@/lib/iban";

/**
 * Builds a Czech SPAYD (Short Payment Descriptor) string for QR Platba.
 * Spec: https://qr-platba.cz/pro-vyvojare/specifikace-formatu/
 */
export function buildSpayd(params: {
  iban: string;
  amount: number;
  message?: string;
  recipientName?: string;
}): string {
  const iban = normalizeIban(params.iban);
  const amount = params.amount.toFixed(2);
  const parts = [
    "SPD*1.0",
    `ACC:${iban}`,
    `AM:${amount}`,
    "CC:CZK",
  ];

  if (params.message) {
    parts.push(`MSG:${sanitize(params.message)}`);
  }
  if (params.recipientName) {
    parts.push(`RN:${sanitize(params.recipientName)}`);
  }

  return parts.join("*");
}

function sanitize(value: string): string {
  return value.replace(/\*/g, " ").trim().slice(0, 60);
}
