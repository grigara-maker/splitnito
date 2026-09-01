/**
 * Komprese fotky dokladu pro OCR i archiv — bez nových závislostí (Canvas API).
 * PDF a nepodporované formáty vrací beze změny.
 *
 * Záměrně vzniká jediná varianta, která slouží zároveň jako vstup pro OCR
 * i jako obrázek do Storage. Dřív se kódovalo dvakrát (menší pro OCR, větší
 * pro archiv), což na mobilu stálo víc času než kolik ušetřily menší přenosy.
 */

/** Účtenka zůstane čitelná a Gemini si poradí i s drobným textem. */
const MAX_EDGE = 1400;
const QUALITY = 0.78;

/** Pod touto hranicí se komprese nevyplatí. */
const SKIP_UNDER_BYTES = 320_000;

/**
 * Vercel odmítne požadavek s tělem nad 4,5 MB dřív, než doběhne do route
 * handleru (HTTP 413). Držíme se bezpečně pod limitem.
 */
export const OCR_MAX_BYTES = 3_800_000;

/** Postupné zmenšování, když ani výchozí komprese nestačí. */
const FALLBACK_STEPS = [
  { maxEdge: 1100, quality: 0.68 },
  { maxEdge: 850, quality: 0.6 },
  { maxEdge: 650, quality: 0.5 },
];

/**
 * JPEG, ne WebP: prohlížeče ho kódují zhruba šestkrát rychleji a bývá
 * hardwarově akcelerovaný. WebP je sice o třetinu menší, ale ušetřené bajty
 * se na běžném mobilním uploadu nevrátí.
 */
const MIME = "image/jpeg";

function toJpegFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "receipt";
  return new File([blob], `${base}.jpg`, { type: MIME });
}

function render(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number
): Promise<Blob | null> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, MIME, quality);
  });
}

async function shrinkUnderLimit(
  bitmap: ImageBitmap,
  current: File
): Promise<File> {
  let result = current;
  for (const step of FALLBACK_STEPS) {
    if (result.size <= OCR_MAX_BYTES) break;
    const blob = await render(bitmap, step.maxEdge, step.quality);
    if (blob && blob.size < result.size) {
      result = toJpegFile(blob, current.name);
    }
  }
  return result;
}

/**
 * Jedna varianta obrázku pro OCR i Storage. Nepodporované formáty (PDF)
 * a dost malé obrázky prochází beze změny.
 */
export async function prepareReceiptFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }
  if (file.size <= SKIP_UNDER_BYTES) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    // Skoro správně velký obrázek nemá smysl překódovávat.
    if (scale >= 0.92 && file.size < SKIP_UNDER_BYTES * 2) {
      return file;
    }

    const blob = await render(bitmap, MAX_EDGE, QUALITY);
    let result = blob && blob.size < file.size ? toJpegFile(blob, file.name) : file;

    if (result.size > OCR_MAX_BYTES) {
      result = await shrinkUnderLimit(bitmap, result);
    }
    return result;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
