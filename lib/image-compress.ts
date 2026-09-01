/**
 * Komprese fotky pro OCR / upload — bez nových závislostí (Canvas API).
 * PDF a nepodporované formáty vrací beze změny.
 */

/** OCR: menší = rychlejší upload i Gemini inference (účtenky stačí). */
const OCR_MAX_EDGE = 1280;
const OCR_QUALITY = 0.72;
const OCR_SKIP_UNDER_BYTES = 280_000;

/**
 * Vercel odmítne požadavek s tělem nad 4,5 MB dřív, než doběhne do route
 * handleru (HTTP 413). Držíme se bezpečně pod limitem i s režií multipartu.
 */
export const OCR_MAX_BYTES = 3_800_000;

/** Postupné zmenšování, když ani výchozí komprese nestačí. */
const OCR_FALLBACK_STEPS = [
  { maxEdge: 1024, quality: 0.62 },
  { maxEdge: 800, quality: 0.55 },
  { maxEdge: 640, quality: 0.5 },
];

/** Storage: pořád čitelný doklad, ale ne 5–10 MB z telefonu. */
const UPLOAD_MAX_EDGE = 1800;
const UPLOAD_QUALITY = 0.84;
const UPLOAD_SKIP_UNDER_BYTES = 700_000;

let webpEncodingSupport: boolean | null = null;

/**
 * WebP je při stejné kvalitě zhruba o třetinu menší než JPEG, takže se
 * znatelně zkrátí upload z mobilu i inference nad obrázkem. Starší Safari
 * ho ale neumí zakódovat — tam se tiše vrátíme k JPEGu.
 */
function encodeMimeType(): "image/webp" | "image/jpeg" {
  if (webpEncodingSupport == null) {
    try {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      webpEncodingSupport = probe
        .toDataURL("image/webp")
        .startsWith("data:image/webp");
    } catch {
      webpEncodingSupport = false;
    }
  }
  return webpEncodingSupport ? "image/webp" : "image/jpeg";
}

function toImageFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "receipt";
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${base}.${ext}`, {
    type: blob.type || "image/jpeg",
  });
}

async function renderCompressed(
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
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, encodeMimeType(), quality);
  });
}

async function compressImage(
  file: File,
  maxEdge: number,
  quality: number,
  skipUnderBytes: number
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }
  if (file.size <= skipUnderBytes) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxEdge / Math.max(bitmap.width, bitmap.height)
    );

    if (scale >= 0.92 && file.size < skipUnderBytes * 2) {
      bitmap.close();
      return file;
    }

    const blob = await renderCompressed(bitmap, maxEdge, quality);
    bitmap.close();
    if (!blob || blob.size >= file.size) {
      return file;
    }
    return toImageFile(blob, file.name);
  } catch {
    return file;
  }
}

async function shrinkUnderOcrLimit(
  bitmap: ImageBitmap,
  current: File
): Promise<File> {
  let result = current;
  for (const step of OCR_FALLBACK_STEPS) {
    if (result.size <= OCR_MAX_BYTES) break;
    const blob = await renderCompressed(bitmap, step.maxEdge, step.quality);
    if (blob && blob.size < result.size) {
      result = toImageFile(blob, current.name);
    }
  }
  return result;
}

/** Menší JPEG pro Gemini OCR (rychlejší upload i inference). */
export function compressImageForOcr(file: File): Promise<File> {
  return compressImage(file, OCR_MAX_EDGE, OCR_QUALITY, OCR_SKIP_UNDER_BYTES);
}

/** Rozumná velikost do Storage (stále čitelný doklad). */
export function compressImageForUpload(file: File): Promise<File> {
  return compressImage(
    file,
    UPLOAD_MAX_EDGE,
    UPLOAD_QUALITY,
    UPLOAD_SKIP_UNDER_BYTES
  );
}

export type PreparedReceiptImages = {
  ocr: File;
  /** Komprese pro Storage může dobíhat souběžně s OCR požadavkem. */
  upload: Promise<File>;
};

async function prepareUploadFromBitmap(
  bitmap: ImageBitmap,
  file: File,
  maxDim: number,
  ocr: File
): Promise<File> {
  try {
    if (file.size <= UPLOAD_SKIP_UNDER_BYTES) return file;

    const uploadScale = Math.min(1, UPLOAD_MAX_EDGE / maxDim);
    if (
      uploadScale >= 0.92 &&
      file.size < UPLOAD_SKIP_UNDER_BYTES * 2
    ) {
      return file;
    }

    // Zachovává stávající možnost znovu použít dostatečně velkou OCR variantu.
    if (
      ocr !== file &&
      ocr.size <= UPLOAD_SKIP_UNDER_BYTES &&
      OCR_MAX_EDGE >= UPLOAD_MAX_EDGE * 0.85
    ) {
      return ocr;
    }

    const blob = await renderCompressed(bitmap, UPLOAD_MAX_EDGE, UPLOAD_QUALITY);
    if (blob && blob.size < file.size) {
      return toImageFile(blob, file.name);
    }
    return file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

/**
 * Připraví OCR soubor jako první. Storage varianta pak může dobíhat zároveň
 * se síťovým OCR požadavkem, aniž by se obrázek dekódoval podruhé.
 */
export async function prepareImagesForReceipt(
  file: File
): Promise<PreparedReceiptImages> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { ocr: file, upload: Promise.resolve(file) };
  }

  const needsOcr = file.size > OCR_SKIP_UNDER_BYTES;
  const needsUpload = file.size > UPLOAD_SKIP_UNDER_BYTES;
  if (!needsOcr && !needsUpload) {
    return { ocr: file, upload: Promise.resolve(file) };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxDim = Math.max(bitmap.width, bitmap.height);

    let ocr = file;
    if (needsOcr) {
      const ocrScale = Math.min(1, OCR_MAX_EDGE / maxDim);
      if (!(ocrScale >= 0.92 && file.size < OCR_SKIP_UNDER_BYTES * 2)) {
        const blob = await renderCompressed(bitmap, OCR_MAX_EDGE, OCR_QUALITY);
        if (blob && blob.size < file.size) {
          ocr = toImageFile(blob, file.name);
        }
      }
      if (ocr.size > OCR_MAX_BYTES) {
        ocr = await shrinkUnderOcrLimit(bitmap, ocr);
      }
    }

    const upload = prepareUploadFromBitmap(bitmap, file, maxDim, ocr);
    bitmap = null; // zavře ji prepareUploadFromBitmap ve finally
    return { ocr, upload };
  } catch {
    bitmap?.close();
    return { ocr: file, upload: Promise.resolve(file) };
  }
}

/**
 * Jedno dekódování → OCR + upload varianty (ušetří čas na mobilu).
 */
export async function compressImagesForReceipt(
  file: File
): Promise<{ ocr: File; upload: File }> {
  const prepared = await prepareImagesForReceipt(file);
  return { ocr: prepared.ocr, upload: await prepared.upload };
}
