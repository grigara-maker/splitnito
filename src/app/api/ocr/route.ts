import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type OcrResult = {
  vendor: string | null;
  totalAmount: number | null;
  items: Array<{ name: string; amount?: number }>;
};

/**
 * Gemini 1.5 Flash is shut down; use current Flash for the same role.
 * Override with GEMINI_OCR_MODEL if needed.
 */
const GEMINI_MODEL =
  process.env.GEMINI_OCR_MODEL?.trim() || "gemini-2.0-flash";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY není nastavený. Přidejte ho do Vercel Environment Variables (a lokálně do .env.local).",
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }

  const mimeType = file.type || "image/jpeg";
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
    return NextResponse.json(
      { error: "Podporované jsou obrázky a PDF." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const prompt = `You are reading a Czech or international receipt / invoice photo.
Extract structured data and respond ONLY with JSON matching this schema:
{
  "vendor": string | null,       // merchant / supplier name (e.g. "Albert")
  "totalAmount": number | null,  // final amount to pay, as a number (no currency symbol)
  "items": [{"name": string, "amount": number}]  // optional line items; empty array if unknown
}
Rules:
- totalAmount must be the grand total (including tax if shown as final payment).
- Use a dot as decimal separator.
- If a field is unreadable, use null (or [] for items).
- Do not invent values.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      {
        error: `Gemini API chyba: ${response.status} ${text.slice(0, 300)}`,
      },
      { status: 502 }
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!rawText) {
    return NextResponse.json(
      { error: "Gemini nevrátil žádný výsledek OCR." },
      { status: 502 }
    );
  }

  let parsed: OcrResult;
  try {
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(jsonText) as OcrResult;
  } catch {
    return NextResponse.json(
      { error: "Nepodařilo se zpracovat odpověď z Gemini." },
      { status: 502 }
    );
  }

  const vendor =
    typeof parsed.vendor === "string" && parsed.vendor.trim()
      ? parsed.vendor.trim()
      : null;

  let totalAmount: number | null = null;
  if (typeof parsed.totalAmount === "number" && !Number.isNaN(parsed.totalAmount)) {
    totalAmount = parsed.totalAmount;
  } else if (typeof parsed.totalAmount === "string") {
    const n = Number(String(parsed.totalAmount).replace(",", ".").replace(/\s/g, ""));
    totalAmount = Number.isNaN(n) ? null : n;
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((item) => ({
          name: String(item?.name ?? "Položka").trim() || "Položka",
          amount:
            typeof item?.amount === "number" && !Number.isNaN(item.amount)
              ? item.amount
              : undefined,
        }))
        .filter((item) => item.name)
    : [];

  return NextResponse.json({
    vendor,
    totalAmount,
    items,
  });
}
