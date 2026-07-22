import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type OcrResult = {
  vendor: string | null;
  totalAmount: number | null;
  items: Array<{ name: string; amount?: number }>;
};

/**
 * Free-tier limity (Google AI Studio): gemini-2.0-flash má často 0/0 → 429.
 * Preferuj 2.5 / 3.x Flash Lite, které mají reálnou RPD kvótu.
 * Override: GEMINI_OCR_MODEL ve Vercelu.
 */
const GEMINI_MODELS = [
  process.env.GEMINI_OCR_MODEL?.trim(),
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-3.6-flash",
].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

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

  const requestBody = {
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
  };

  let lastStatus = 0;
  let lastText = "";
  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  } | null = null;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    lastStatus = response.status;
    lastText = await response.text();

    if (response.ok) {
      try {
        data = JSON.parse(lastText) as typeof data;
      } catch {
        data = null;
      }
      if (data) break;
    }

    // 429 = quota — zkus další model; jiné chyby hned končí
    if (response.status !== 429 && response.status !== 404) {
      break;
    }
  }

  if (!data) {
    if (lastStatus === 429) {
      return NextResponse.json(
        {
          error:
            "OCR: Gemini odmítlo požadavek (429). U free tieru má model gemini-2.0-flash často limit 0 — aplikace teď používá gemini-2.5-flash-lite. Zkontrolujte GEMINI_API_KEY a model v projektu Splitnito, případně nastavte GEMINI_OCR_MODEL=gemini-2.5-flash-lite. Mezitím můžete doklad vyplnit ručně.",
          code: "QUOTA_EXCEEDED",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: `Gemini API chyba: ${lastStatus} ${lastText.slice(0, 200)}`,
      },
      { status: 502 }
    );
  }

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
