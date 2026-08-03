// Branded share-card rendering. Draws a professional PNG on a canvas — no
// network, no AI credits, works offline.

export type ShareTemplate = "quote" | "educational" | "business" | "tutorial" | "code";

export type ShareCardOptions = {
  title?: string;
  body: string;
  template?: ShareTemplate;
  /** Optional generated image rendered as the card hero. */
  imageUrl?: string | null;
  footer?: string;
};

const W = 1080;
const PAD = 72;

const THEMES: Record<ShareTemplate, { bg: [string, string]; accent: string; text: string; muted: string; mono?: boolean }> = {
  quote: { bg: ["#141024", "#1d1233"], accent: "#a855f7", text: "#f5f3ff", muted: "#b8aee0" },
  educational: { bg: ["#0d1524", "#102033"], accent: "#22d3ee", text: "#eef7ff", muted: "#9fc0d6" },
  business: { bg: ["#101215", "#1a1d22"], accent: "#e2b13c", text: "#f7f5f0", muted: "#bdb6a6" },
  tutorial: { bg: ["#0f1a14", "#132a1f"], accent: "#34d399", text: "#effaf4", muted: "#a3c8b6" },
  code: { bg: ["#0c0c10", "#16161d"], accent: "#8b5cf6", text: "#e6e6ef", muted: "#9a9ab0", mono: true },
};

/** Pick a template from the content itself. */
export function pickTemplate(text: string, kind?: string): ShareTemplate {
  if (kind === "code" || /```/.test(text)) return "code";
  if (/^\s*(\d+\.|step\s+\d)/im.test(text)) return "tutorial";
  if (/^#{1,3}\s/m.test(text) || /\b(definition|概念|because|therefore)\b/i.test(text)) return "educational";
  if (text.trim().length <= 220) return "quote";
  return "business";
}

function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[\w+#-]*\n?/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Render the share card and return it as a PNG blob. */
export async function renderShareCard(opts: ShareCardOptions): Promise<Blob> {
  const template = opts.template ?? pickTemplate(opts.body);
  const theme = THEMES[template];
  const bodyText = plain(opts.body);
  const hero = opts.imageUrl ? await loadImage(opts.imageUrl) : null;

  const bodyFont = theme.mono
    ? '400 30px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    : '400 34px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const lineH = theme.mono ? 44 : 50;
  const maxW = W - PAD * 2;

  // Measure first on a scratch context.
  const scratch = document.createElement("canvas").getContext("2d")!;
  scratch.font = bodyFont;
  let lines = wrap(scratch, bodyText, maxW);
  const MAX_LINES = hero ? 10 : 22;
  let truncated = false;
  if (lines.length > MAX_LINES) {
    lines = lines.slice(0, MAX_LINES);
    truncated = true;
  }

  const heroH = hero ? Math.min(620, Math.round((maxW * hero.height) / hero.width)) : 0;
  const headerH = 150;
  const titleH = opts.title ? 78 : 0;
  const footerH = 118;
  const H = Math.max(
    720,
    headerH + titleH + (hero ? heroH + 40 : 0) + lines.length * lineH + (truncated ? 46 : 0) + footerH + PAD,
  );

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bg[0]);
  grad.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent glow
  const glow = ctx.createRadialGradient(W - 120, 80, 20, W - 120, 80, 460);
  glow.addColorStop(0, `${theme.accent}44`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, 10, H);

  // Header — brand
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(PAD + 20, 78, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.text;
  ctx.font = '600 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("NovaMind AI", PAD + 56, 80);

  let y = headerH;

  if (opts.title) {
    ctx.fillStyle = theme.text;
    ctx.font = '700 46px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = "top";
    const tLines = wrap(ctx, opts.title, maxW).slice(0, 1);
    ctx.fillText(tLines[0] ?? "", PAD, y);
    y += titleH;
  }

  if (hero) {
    ctx.save();
    roundRect(ctx, PAD, y, maxW, heroH, 28);
    ctx.clip();
    ctx.drawImage(hero, PAD, y, maxW, heroH);
    ctx.restore();
    y += heroH + 40;
  }

  ctx.fillStyle = theme.text;
  ctx.font = bodyFont;
  ctx.textBaseline = "top";
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += lineH;
  }
  if (truncated) {
    ctx.fillStyle = theme.muted;
    ctx.font = 'italic 28px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText("…continued in NovaMind AI", PAD, y + 8);
  }

  // Footer
  ctx.fillStyle = `${theme.muted}33`;
  ctx.fillRect(PAD, H - footerH, maxW, 2);
  ctx.fillStyle = theme.muted;
  ctx.font = '400 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText(opts.footer ?? "Created with NovaMind AI", PAD, H - footerH / 2 + 6);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render share card."))), "image/png", 0.95),
  );
}

export function shareCardDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Preview failed."));
    fr.readAsDataURL(blob);
  });
}
