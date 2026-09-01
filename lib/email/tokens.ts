import { createHmac, timingSafeEqual } from "node:crypto";

import { getTokenSecret } from "@/lib/email/config";

export type PaymentTokenPayload = {
  /** `pay` = plátce potvrzuje odeslání, `receive` = příjemce potvrzuje přijetí */
  action: "pay" | "receive";
  eventId: string;
  transferId: string;
  userId: string;
  /** Unix timestamp v sekundách */
  exp: number;
};

export type QrTokenPayload = {
  iban: string;
  amount: number;
  message?: string;
  recipientName?: string;
};

const DEFAULT_TTL_DAYS = 120;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function signPayload(payload: unknown): string {
  const secret = getTokenSecret();
  if (!secret) {
    throw new Error(
      "Chybí EMAIL_TOKEN_SECRET (nebo SUPABASE_SERVICE_ROLE_KEY) — odkazy v e-mailech nelze podepsat."
    );
  }
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

function verifyPayload<T>(token: string): T | null {
  const secret = getTokenSecret();
  if (!secret) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, sign(body, secret))) return null;

  try {
    return JSON.parse(base64UrlDecode(body)) as T;
  } catch {
    return null;
  }
}

export function createPaymentToken(
  payload: Omit<PaymentTokenPayload, "exp"> & { ttlDays?: number }
): string {
  const ttlDays = payload.ttlDays ?? DEFAULT_TTL_DAYS;
  return signPayload({
    action: payload.action,
    eventId: payload.eventId,
    transferId: payload.transferId,
    userId: payload.userId,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60,
  } satisfies PaymentTokenPayload);
}

export function verifyPaymentToken(
  token: string
): PaymentTokenPayload | null {
  const payload = verifyPayload<PaymentTokenPayload>(token);
  if (!payload) return null;
  if (payload.action !== "pay" && payload.action !== "receive") return null;
  if (!payload.eventId || !payload.transferId || !payload.userId) return null;
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) {
    return null;
  }
  return payload;
}

export function createQrToken(payload: QrTokenPayload): string {
  return signPayload(payload);
}

export function verifyQrToken(token: string): QrTokenPayload | null {
  const payload = verifyPayload<QrTokenPayload>(token);
  if (!payload?.iban || !Number.isFinite(Number(payload.amount))) return null;
  return { ...payload, amount: Number(payload.amount) };
}
