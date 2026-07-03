// Client-side image processing: validate, compress to JPEG, return data URL.
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB hard cap (post-compression)
export const TARGET_MAX_DIM = 1600; // px; downscale long edge

export function isAcceptedImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (ACCEPTED_IMAGE_MIME.includes(t)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export async function compressImage(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ dataUrl: string; bytes: number; mime: string; name: string }> {
  onProgress?.(5);
  const bitmap = await loadBitmap(file);
  onProgress?.(35);

  const { width, height } = fitWithin(bitmap.width, bitmap.height, TARGET_MAX_DIM);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  onProgress?.(60);

  // Try qualities from high → low until under 4MB (post-base64 ~5.4MB).
  const qualities = [0.85, 0.7, 0.55, 0.4];
  let blob: Blob | null = null;
  for (const q of qualities) {
    blob = await canvasToBlob(canvas, "image/jpeg", q);
    if (blob && blob.size < 4 * 1024 * 1024) break;
  }
  if (!blob) throw new Error("Compression failed");
  onProgress?.(85);

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large even after compression (max 20MB).");
  }
  const dataUrl = await blobToDataUrl(blob);
  onProgress?.(100);
  return { dataUrl, bytes: blob.size, mime: "image/jpeg", name: renameToJpg(file.name) };
}

function renameToJpg(name: string) {
  return name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
}

function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall back to <img>
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

// Detect Android/iOS in-app WebViews where Google OAuth is blocked (403 disallowed_useragent).
export function isInAppWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Android WebView: contains "; wv)" ; many in-app browsers
  if (/; wv\)/i.test(ua)) return true;
  if (/(FBAN|FBAV|Instagram|Line|Twitter|TikTok|Snapchat|MicroMessenger|WeChat|GSA|OPiOS|Opera Mini|OPT\/)/i.test(ua)) return true;
  // iOS embedded WebView: iPhone/iPad without Safari token
  if (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua)) return true;
  // Generic AppGeyser / Android app hint
  if (/AppGeyser|wv\b/i.test(ua) && /Android/i.test(ua)) return true;
  return false;
}
