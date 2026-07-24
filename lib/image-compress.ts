/**
 * Komprese fotky pro OCR / upload — bez nových závislostí (Canvas API).
 * PDF a nepodporované formáty vrací beze změny.
 */

const OCR_MAX_EDGE = 1600;
const OCR_QUALITY = 0.82;
const OCR_SKIP_UNDER_BYTES = 450_000;

const UPLOAD_MAX_EDGE = 2200;
const UPLOAD_QUALITY = 0.88;
const UPLOAD_SKIP_UNDER_BYTES = 900_000;

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

    // Už je malý a soubor není obří → nic neměň
    if (scale >= 0.92 && file.size < skipUnderBytes * 2) {
      bitmap.close();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
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
