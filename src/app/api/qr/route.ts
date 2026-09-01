import QRCode from "qrcode";
import type { NextRequest } from "next/server";

import { verifyQrToken } from "@/lib/email/tokens";
import { buildSpayd } from "@/lib/spayd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QR platba jako PNG pro e-maily — parametry jsou podepsané HMAC,
 * takže endpoint nejde zneužít k vygenerování cizí platby.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return new Response("Chybí parametr t.", { status: 400 });
  }

  const payload = verifyQrToken(token);
  if (!payload) {
    return new Response("Neplatný podpis.", { status: 403 });
  }

  try {
    const spayd = buildSpayd({
      iban: payload.iban,
      amount: payload.amount,
      message: payload.message,
      recipientName: payload.recipientName,
    });

    const png = await QRCode.toBuffer(spayd, {
      type: "png",
      width: 600,
      margin: 1,
      color: { dark: "#16323a", light: "#ffffff" },
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("QR kód se nepodařilo vytvořit.", { status: 500 });
  }
}
