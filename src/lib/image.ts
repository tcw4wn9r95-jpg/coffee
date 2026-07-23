export interface ProcessedImage {
  blob: Blob; // resized, for storage
  base64: string; // raw base64 (no data URI prefix), for the API
  mediaType: string; // "image/jpeg"
  objectURL: string; // for preview
}

/**
 * Downscale a captured photo so payloads stay small and fast, then produce both
 * a storable Blob and the base64 the Anthropic API expects.
 */
export async function processImageFile(
  file: File,
  maxEdge = 1280
): Promise<ProcessedImage> {
  const bitmap = await fileToBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) (bitmap as ImageBitmap).close?.();

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("Encode failed"))),
      "image/jpeg",
      0.82
    )
  );
  const base64 = await blobToBase64(blob);
  return {
    blob,
    base64,
    mediaType: "image/jpeg",
    objectURL: URL.createObjectURL(blob),
  };
}

async function fileToBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      res(s.slice(s.indexOf(",") + 1)); // strip data URI prefix
    };
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
