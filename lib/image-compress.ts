/**
 * Komprese fotky pro OCR / upload — bez nových závislostí (Canvas API).
 * PDF a nepodporované formáty vrací beze změny.
 */

/** OCR: menší = rychlejší upload i Gemini inference (účtenky stačí). */
const OCR_MAX_EDGE = 1280;
const OCR_QUALITY = 0.72;
const OCR_SKIP_UNDER_BYTES = 280_000;

/** Storage: pořád čitelný doklad, ale ne 5–10 MB z telefonu. */
const UPLOAD_MAX_EDGE = 1800;
const UPLOAD_QUALITY = 0.84;
const UPLOAD_SKIP_UNDER_BYTES = 700_000;

function toJpegFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "receipt";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

async function renderJpeg(
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
    canvas.toBlob(resolve, "image/jpeg", quality);
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

    const blob = await renderJpeg(bitmap, maxEdge, quality);
    bitmap.close();
    if (!blob || blob.size >= file.size) {
      return file;
    }
    return toJpegFile(blob, file.name);
  } catch {
    return file;
  }
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

/**
 * Jedno dekódování → OCR + upload varianty (ušetří čas na mobilu).
 */
export async function compressImagesForReceipt(
  file: File
): Promise<{ ocr: File; upload: File }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { ocr: file, upload: file };
  }

  const needsOcr = file.size > OCR_SKIP_UNDER_BYTES;
  const needsUpload = file.size > UPLOAD_SKIP_UNDER_BYTES;
  if (!needsOcr && !needsUpload) {
    return { ocr: file, upload: file };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = Math.max(bitmap.width, bitmap.height);

    let ocr = file;
    let upload = file;

    if (needsOcr) {
      const ocrScale = Math.min(1, OCR_MAX_EDGE / maxDim);
      if (!(ocrScale >= 0.92 && file.size < OCR_SKIP_UNDER_BYTES * 2)) {
        const blob = await renderJpeg(bitmap, OCR_MAX_EDGE, OCR_QUALITY);
        if (blob && blob.size < file.size) {
          ocr = toJpegFile(blob, file.name);
        }
      }
    }

    if (needsUpload) {
      const uploadScale = Math.min(1, UPLOAD_MAX_EDGE / maxDim);
      if (!(uploadScale >= 0.92 && file.size < UPLOAD_SKIP_UNDER_BYTES * 2)) {
        // Když OCR už zmenšilo pod upload limit a max edge stačí, znovu použij OCR
        if (
          ocr !== file &&
          ocr.size <= UPLOAD_SKIP_UNDER_BYTES &&
          OCR_MAX_EDGE >= UPLOAD_MAX_EDGE * 0.85
        ) {
          upload = ocr;
        } else {
          const blob = await renderJpeg(bitmap, UPLOAD_MAX_EDGE, UPLOAD_QUALITY);
          if (blob && blob.size < file.size) {
            upload = toJpegFile(blob, file.name);
          }
        }
      }
    }

    bitmap.close();
    return { ocr, upload };
  } catch {
    return { ocr: file, upload: file };
  }
}
