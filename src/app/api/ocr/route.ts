import { NextResponse } from "next/server";

import { parseReceiptPurchasedAt } from "@/lib/datetime-prague";
import { reconcileOcrItemsWithTotal } from "@/lib/ocr-reconcile";
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
 * Pořadí OCR modelů (první = preferovaný).
 * Jen Gemini 3.x — 2.5 Flash(-Lite) už Google pro nové API klíče neposkytuje (404).
 * Při 429 / 404 / chybě / prázdné odpovědi → vždy další v seznamu.
 * Override: GEMINI_OCR_MODEL (zkusí se jako první).
 */
const GEMINI_MODELS = [
  process.env.GEMINI_OCR_MODEL?.trim(),
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

function isModelUnavailable(status: number, body: string): boolean {
  if (status === 404) return true;
  return /no longer available|not found|not supported for|is not found/i.test(
    body
  );
}

function shouldTryNextModel(status: number, body: string): boolean {
  // Quota, nedostupný model, server/transient chyby → další model
  if ([429, 404, 500, 502, 503, 504].includes(status)) return true;
  if (isModelUnavailable(status, body)) return true;
  if (status === 400 && /thinking|thinkingConfig|thinkingBudget|thinkingLevel/i.test(body)) {
    return false; // řeší se retry bez thinking na stejném modelu
  }
  // Jakákoli jiná chyba API — zkus další model (limity, region, …)
  return status >= 400;
}

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

  const prompt = `You are reading a Czech or international receipt / invoice / order summary (incl. TEMU, Amazon, eshop PDFs).
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

CRITICAL — amounts INCLUDING VAT (DPH / tax):
- Prefer "Cena s DPH", "Celkem s DPH", "Celkem k úhradě", "Order total", "Grand total", "Total paid".
- Never prefer net / without VAT when a with-VAT total exists.
- Item prices must be WITH VAT when both are shown.

CRITICAL — unit price vs line total (MOST COMMON ERROR):
A printed number next to quantity can mean EITHER:
  A) PRICE PER PIECE (unitPrice): quantity=2, shown=250 → unitPrice=250, totalPrice=500
  B) LINE TOTAL for all pieces: quantity=2, shown=250 → unitPrice=125, totalPrice=250

YOU MUST DECIDE USING THE INVOICE GRAND TOTAL (totalAmount):
1. Read totalAmount first (final amount customer pays).
2. Build items so that sum(items.totalPrice) ≈ totalAmount (within ~1–2 currency units).
3. If interpretation A makes the items sum far from totalAmount and B matches, use B — and vice versa.
4. NEVER invent unitPrice by dividing a unit-price column by quantity.
5. NEVER set totalPrice = unitPrice when quantity > 1 (unless the document truly shows only one price that is the line total — then unitPrice = that / quantity).

Marketplace / TEMU / table invoices (Unit price | Qty | Amount):
- If a column is labeled Unit price / Price / Cena / Cena/ks → that number is unitPrice; totalPrice = unitPrice × quantity.
- If a column is labeled Amount / Item total / Součet / Celkem za položku → that number is totalPrice; unitPrice = totalPrice / quantity.
- Typical TEMU mistake to AVOID: seeing unit price 250 and qty 2, then outputting unitPrice=125 and totalPrice=250. That is WRONG when 250 is the per-piece price.
- After filling all product lines, VERIFY: sum(totalPrice) must match Order total / Grand total. If not, flip ambiguous lines between (A) and (B) until it fits.

Other rules:
- purchasedAt = exact date and time printed on the receipt (Czech wall clock), format YYYY-MM-DDTHH:mm:ss with NO timezone suffix and NO "Z".
- Do NOT convert to UTC. If the receipt shows 15:30, return "...T15:30:00" (not 13:30Z).
- Date only → use T12:00:00. Unreadable → null.
- quantity default 1.
- Decimal separator: dot.
- Do not invent values. Unreadable → null / [].`;

  const baseGenerationConfig = {
    temperature: 0.05,
    responseMimeType: "application/json" as const,
    maxOutputTokens: 4096,
  };

  type ThinkingMode = "minimal" | "none";

  const makeBody = (thinking: ThinkingMode) => ({
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
      ...baseGenerationConfig,
      // Gemini 3.x: thinkingLevel (thinkingBudget: 0 už není spolehlivé)
      ...(thinking === "minimal"
        ? { thinkingConfig: { thinkingLevel: "minimal" } }
        : {}),
    },
  });

  let lastStatus = 0;
  let lastText = "";
  let data: GeminiResponse | null = null;
  let usedModel: string | null = null;
  const attempted: string[] = [];
  const attemptErrors: string[] = [];

  for (const model of GEMINI_MODELS) {
    attempted.push(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // 3.x: nejdřív minimal thinking (rychlé OCR), pak bez thinkingConfig
    const thinkingAttempts: ThinkingMode[] = model.startsWith("gemini-3")
      ? ["minimal", "none"]
      : ["none"];

    let modelFailed = false;

    for (const thinking of thinkingAttempts) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(thinking)),
      });

      lastStatus = response.status;
      lastText = await response.text();

      if (response.ok) {
        try {
          data = JSON.parse(lastText) as GeminiResponse;
        } catch {
          data = null;
        }
        const hasText = Boolean(
          data?.candidates?.[0]?.content?.parts?.some((p) => p.text?.trim())
        );
        if (data && hasText) {
          usedModel = model;
          break;
        }
        data = null;
        // Prázdná odpověď → zkus další thinking variantu / model
        if (thinking === "minimal" && thinkingAttempts.length > 1) continue;
        attemptErrors.push(`${model}: prázdná odpověď`);
        modelFailed = true;
        break;
      }

      // Model neexistuje / není dostupný → rovnou další model
      if (isModelUnavailable(response.status, lastText)) {
        attemptErrors.push(`${model}: ${lastStatus} nedostupný`);
        modelFailed = true;
        break;
      }

      // thinkingConfig nepodporovaný → zkus bez něj
      if (
        thinking === "minimal" &&
        response.status === 400 &&
        /thinking|thinkingConfig|thinkingBudget|thinkingLevel/i.test(lastText)
      ) {
        continue;
      }

      // Quota / jiná chyba → další model
      if (shouldTryNextModel(response.status, lastText)) {
        attemptErrors.push(`${model}: ${lastStatus}`);
        modelFailed = true;
        break;
      }

      attemptErrors.push(`${model}: ${lastStatus}`);
      modelFailed = true;
      break;
    }

    if (data && usedModel) break;
    if (!modelFailed && data) break;
    // vždy zkus další model, dokud něco neuspěje
  }

  if (!data || !usedModel) {
    const tried = attempted.join(", ");
    if (lastStatus === 429) {
      return NextResponse.json(
        {
          error: `OCR: všechny Gemini modely odmítly požadavek (limit / kvóta). Zkoušeno: ${tried}. Zkuste to za chvíli, nebo doklad vyplňte ručně.`,
          code: "QUOTA_EXCEEDED",
          attempted,
          attemptErrors,
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: `Gemini API chyba (zkoušeno: ${tried}): ${lastStatus} ${lastText.slice(0, 220)}`,
        attempted,
        attemptErrors,
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
  if (
    typeof parsed.totalAmount === "number" &&
    !Number.isNaN(parsed.totalAmount)
  ) {
    totalAmount = parsed.totalAmount;
  } else if (typeof parsed.totalAmount === "string") {
    const n = Number(
      String(parsed.totalAmount).replace(",", ".").replace(/\s/g, "")
    );
    totalAmount = Number.isNaN(n) ? null : n;
  }

  const normalized = Array.isArray(parsed.items)
    ? normalizeReceiptItems(parsed.items)
    : [];
  // Po AI: vyber interpretaci cena/ks vs. cena řádku podle celkové částky
  const items = reconcileOcrItemsWithTotal(normalized, totalAmount);

  let purchasedAt: string | null = null;
  if (typeof parsed.purchasedAt === "string" && parsed.purchasedAt.trim()) {
    purchasedAt = parseReceiptPurchasedAt(parsed.purchasedAt);
  }

  return NextResponse.json({
    vendor,
    totalAmount,
    purchasedAt,
    items,
  });
}
