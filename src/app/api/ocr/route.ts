import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeReceiptItems } from "@/lib/types/database";

type OcrResult = {
  vendor: string | null;
  totalAmount: number | null;
  purchasedAt: string | null;
  items: Array<{
    name: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    amount?: number;
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
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
  "vendor": string | null,
  "totalAmount": number | null,
  "purchasedAt": string | null,
  "items": [
    {
      "name": string,
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number
    }
  ]
}
CRITICAL — always use amounts INCLUDING VAT (DPH / tax). This is mandatory:
- Czech invoices often show TWO totals side by side, e.g. "Cena celkem" / "Celkem" NEXT TO "Cena s DPH" / "Celkem s DPH". Even if "Cena celkem" looks like the final amount, it is usually WITHOUT VAT. ALWAYS take "Cena s DPH" / "Celkem s DPH" / "Celková cena s DPH".
- Never prefer "Cena celkem", "Celkem cena", "Celkem bez DPH", "Základ", or "Netto" when any with-DPH figure exists on the document.
- Prefer labels in this exact priority: "Cena s DPH", "Celkem s DPH", "Celková cena s DPH", "Celkem k úhradě", "K platbě", "Grand total (incl. VAT)", then other WITH-VAT totals.
- Only if the document has NO with-DPH amount at all, fall back to a single shown total.
- Item unitPrice and totalPrice must also be WITH DPH when both net and gross are shown.
- Sanity check: if you see both a smaller "Cena celkem" and a larger "Cena s DPH", totalAmount MUST be the larger with-DPH value.
CRITICAL — quantity × price ambiguity (Czech receipts often write "2x" next to a price):
- A line like "2x … 250" can mean EITHER:
  A) unitPrice=250, quantity=2, totalPrice=500 (price per piece), OR
  B) totalPrice=250 for quantity=2 together, so unitPrice=125 (line total shown).
- You MUST decide which interpretation is correct by checking against totalAmount (with DPH):
  1. First read totalAmount (grand total with DPH).
  2. For each ambiguous line, consider both interpretations.
  3. Prefer the set of item totalPrices whose SUM is closest to totalAmount (within ~1–2 CZK).
  4. If interpretation A makes the items sum way above/below the invoice total, and B matches, use B — and vice versa.
  5. Always fill: quantity, unitPrice (per 1 piece), totalPrice (= quantity * unitPrice, rounded to 2 decimals).
- Example: items show "2x Káva 250" and "1x Bageta 80", invoice total 330 → 250 is line total (2×125), not 2×250.
- Example: items show "2x Káva 250" and total 500 → 250 is unit price (2×250=500).
Other rules:
- purchasedAt = date and time of purchase printed on the receipt (NOT upload time), ISO-8601 like "2024-03-15T14:32:00". If only a date is visible, use noon local time. If unreadable, null.
- quantity = number of pieces/units (default 1 if unknown).
- After extracting all items, re-check: sum(item.totalPrice) should match totalAmount within ~1 CZK when items look complete; if not, re-evaluate ambiguous quantity/price lines.
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
  let data: GeminiResponse | null = null;

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
        data = JSON.parse(lastText) as GeminiResponse;
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
    ? normalizeReceiptItems(parsed.items)
    : [];

  let purchasedAt: string | null = null;
  if (typeof parsed.purchasedAt === "string" && parsed.purchasedAt.trim()) {
    const d = new Date(parsed.purchasedAt.trim());
    if (!Number.isNaN(d.getTime())) {
      purchasedAt = d.toISOString();
    }
  }

  return NextResponse.json({
    vendor,
    totalAmount,
    purchasedAt,
    items,
  });
}
