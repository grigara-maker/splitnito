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
 * Flash-Lite první = nejrychlejší pro extrakci z dokladů (~350 tok/s).
 * Těžší Flash jen jako fallback při chybě/limitu.
 * Override: GEMINI_OCR_MODEL (zkusí se jako první).
 */
const GEMINI_MODELS = [
  process.env.GEMINI_OCR_MODEL?.trim(),
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
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
  const apiKey = process.env.GEMINI_API_KEY;

  // Auth + formData paralelně (ušetří ~50–150 ms)
  const [userResult, formData] = await Promise.all([
    supabase.auth.getUser(),
    request.formData(),
  ]);

  const user = userResult.data.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY není nastavený. Přidejte ho do Vercel Environment Variables (a lokálně do .env.local).",
      },
      { status: 503 }
    );
  }

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

  const prompt = `Extract receipt/invoice data (CZ or international, incl. TEMU/Amazon). Reply ONLY with JSON:
{"vendor":string|null,"totalAmount":number|null,"purchasedAt":string|null,"items":[{"name":string,"quantity":number,"unitPrice":number,"totalPrice":number}]}

Rules:
- Amounts WITH VAT (Cena s DPH / Celkem k úhradě / Order total / Grand total). Never prefer net without VAT.
- Unit vs line total: use grand totalAmount so sum(items.totalPrice) ≈ totalAmount. If qty=2 and shown=250 is per-piece → unitPrice=250,totalPrice=500; if it's line total → unitPrice=125,totalPrice=250. Never invent by wrong division.
- TEMU tables: Unit price column = unitPrice; Amount/Item total = totalPrice. Verify sum vs Order total.
- purchasedAt = printed date/time as YYYY-MM-DDTHH:mm:ss (Czech wall clock, NO Z/timezone). Date only → T12:00:00. Unreadable → null.
- quantity default 1. Decimal dot. Do not invent; unreadable → null/[].`;

  const baseGenerationConfig = {
    temperature: 0.05,
    responseMimeType: "application/json" as const,
    maxOutputTokens: 2048,
  };

  type ThinkingMode = "minimal" | "none";

  const makeBody = (thinking: ThinkingMode) => ({
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      ...baseGenerationConfig,
      // Flash-Lite default je minimal; explicitně držíme nízkou latenci
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

    // Jedna thinking varianta; retry bez configu jen při 400 na thinking*
    const thinkingAttempts: ThinkingMode[] = model.startsWith("gemini-3")
      ? ["minimal"]
      : ["none"];

    let modelFailed = false;

    for (let i = 0; i < thinkingAttempts.length; i++) {
      const thinking = thinkingAttempts[i]!;
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

      // thinkingConfig nepodporovaný → jednou zkus bez něj
      if (
        thinking === "minimal" &&
        response.status === 400 &&
        /thinking|thinkingConfig|thinkingBudget|thinkingLevel/i.test(lastText)
      ) {
        thinkingAttempts.push("none");
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
