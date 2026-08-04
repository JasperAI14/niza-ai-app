// Client-side watermarking for free-plan generated images.
// Free users see the mark in-app (CSS overlay) and get it baked into downloads.

const MARK = "Niza AI";

export async function bakeWatermark(src: string): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const pad = Math.round(Math.min(canvas.width, canvas.height) * 0.03);
  const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.035));
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  // Soft shadow keeps the mark legible on light and dark artwork.
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.round(fontSize * 0.4);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(MARK, canvas.width - pad, canvas.height - pad);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export async function downloadImageWithWatermark(url: string, watermarked: boolean, filename = "niza.png") {
  try {
    const blob = watermarked ? await bakeWatermark(url) : await (await fetch(url, { mode: "cors" })).blob();
    triggerDownload(blob, filename);
  } catch {
    // Fall back to opening the raw asset if canvas/CORS export is blocked.
    window.open(url, "_blank", "noopener");
  }
}

export function triggerDownload(blob: Blob, filename: string) {
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}
