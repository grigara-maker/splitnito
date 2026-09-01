import {
  createPaymentToken,
  createQrToken,
  type QrTokenPayload,
} from "@/lib/email/tokens";
import { getSiteUrl } from "@/lib/site";

export function eventUrl(eventId: string): string {
  return `${getSiteUrl()}/events/${eventId}`;
}

/** Veřejný odkaz na potvrzení platby — funguje i bez přihlášení. */
export function paymentActionUrl(params: {
  action: "pay" | "receive";
  eventId: string;
  transferId: string;
  userId: string;
}): string {
  const token = createPaymentToken(params);
  return `${getSiteUrl()}/p/${encodeURIComponent(token)}`;
}

/** Podepsaná URL na server-side vygenerovaný QR kód (obrázek v e-mailu). */
export function qrImageUrl(payload: QrTokenPayload): string {
  const token = createQrToken(payload);
  return `${getSiteUrl()}/api/qr?t=${encodeURIComponent(token)}`;
}
