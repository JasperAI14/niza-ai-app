import { useEffect, useRef, useState } from "react";
import {
  X, Download, Pencil, Circle as CircleIcon, ArrowUpRight, Highlighter, Undo2,
  Trash2, ZoomIn, ZoomOut, Maximize, Share2, MousePointer2,
} from "lucide-react";
import { toast } from "sonner";
import { triggerDownload } from "@/lib/watermark";

type Tool = "pan" | "draw" | "circle" | "arrow" | "highlight";
type Shape =
  | { t: "draw"; color: string; width: number; pts: Array<[number, number]> }
  | { t: "highlight"; color: string; width: number; pts: Array<[number, number]> }
  | { t: "circle"; color: string; width: number; x1: number; y1: number; x2: number; y2: number }
  | { t: "arrow"; color: string; width: number; x1: number; y1: number; x2: number; y2: number };

const COLORS = ["#FF4D4D", "#FFD24D", "#4DFF88", "#4DC3FF", "#C77DFF", "#FFFFFF"];

export function ImageViewer({
  url,
  watermarked,
  onClose,
  onSendToEdit,
}: {
  url: string;
  watermarked?: boolean;
  onClose: () => void;
  onSendToEdit?: (url: string) => void;
}) {
  const [tool, setTool] = useState<Tool>("pan");
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => toast.error("Could not load this image.");
    i.src = url;
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // ---- rendering ----
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const all = drawing ? [...shapes, drawing] : shapes;
    for (const s of all) paint(ctx, s, c.width);
    if (watermarked) paintWatermark(ctx, c.width, c.height);
  }, [img, shapes, drawing, watermarked]);

  function paint(ctx: CanvasRenderingContext2D, s: Shape, w: number) {
    const scale = w / 1000;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = s.width * scale;
    if (s.t === "highlight") {
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = s.width * scale * 3;
    }
    if (s.t === "draw" || s.t === "highlight") {
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    } else if (s.t === "circle") {
      const cx = (s.x1 + s.x2) / 2;
      const cy = (s.y1 + s.y2) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(s.x2 - s.x1) / 2, Math.abs(s.y2 - s.y1) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const head = 18 * scale;
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(ang - Math.PI / 7), s.y2 - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(s.x2 - head * Math.cos(ang + Math.PI / 7), s.y2 - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    ctx.restore();
  }

  function paintWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const pad = Math.round(Math.min(w, h) * 0.03);
    const size = Math.max(14, Math.round(Math.min(w, h) * 0.035));
    ctx.save();
    ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText("Niza AI", w - pad, h - pad);
    ctx.restore();
  }

  // ---- pointer handling ----
  function toImageCoords(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "pan") {
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }
    const { x, y } = toImageCoords(e);
    const width = 4;
    if (tool === "draw") setDrawing({ t: "draw", color, width, pts: [[x, y]] });
    else if (tool === "highlight") setDrawing({ t: "highlight", color, width, pts: [[x, y]] });
    else setDrawing({ t: tool, color, width, x1: x, y1: y, x2: x, y2: y });
  }

  function onMove(e: React.PointerEvent) {
    if (tool === "pan") {
      const p = panStart.current;
      if (!p) return;
      setOffset({ x: p.ox + (e.clientX - p.x), y: p.oy + (e.clientY - p.y) });
      return;
    }
    if (!drawing) return;
    const { x, y } = toImageCoords(e);
    setDrawing((d) => {
      if (!d) return d;
      if (d.t === "draw" || d.t === "highlight") return { ...d, pts: [...d.pts, [x, y] as [number, number]] };
      return { ...d, x2: x, y2: y };
    });
  }

  function onUp() {
    panStart.current = null;
    if (drawing) {
      setShapes((s) => [...s, drawing]);
      setDrawing(null);
    }
  }

  async function exportBlob(): Promise<Blob> {
    const c = canvasRef.current!;
    return await new Promise((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("Export failed"))), "image/png"),
    );
  }

  async function download() {
    try {
      triggerDownload(await exportBlob(), `niza-${Date.now()}.png`);
      toast.success("Image downloaded.");
    } catch {
      toast.error("Could not export the image.");
    }
  }

  async function share() {
    try {
      const blob = await exportBlob();
      const file = new File([blob], "niza.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      return; // user cancelled
    }
    download();
  }

  const tools: Array<{ id: Tool; icon: typeof Pencil; label: string }> = [
    { id: "pan", icon: MousePointer2, label: "Pan" },
    { id: "draw", icon: Pencil, label: "Draw" },
    { id: "circle", icon: CircleIcon, label: "Circle" },
    { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
    { id: "highlight", icon: Highlighter, label: "Highlight" },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-2 text-white">
        <span className="ml-1 flex-1 truncate text-sm font-medium">Image</span>
        <IconBtn onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} label="Zoom out"><ZoomOut className="h-4 w-4" /></IconBtn>
        <span className="w-12 text-center text-xs tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
        <IconBtn onClick={() => setZoom((z) => Math.min(6, +(z + 0.25).toFixed(2)))} label="Zoom in"><ZoomIn className="h-4 w-4" /></IconBtn>
        <IconBtn onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} label="Fit"><Maximize className="h-4 w-4" /></IconBtn>
        <IconBtn onClick={share} label="Share"><Share2 className="h-4 w-4" /></IconBtn>
        <IconBtn onClick={download} label="Download"><Download className="h-4 w-4" /></IconBtn>
        <IconBtn onClick={onClose} label="Close"><X className="h-5 w-5" /></IconBtn>
      </div>

      {/* Canvas stage */}
      <div ref={wrapRef} className="relative flex flex-1 items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="max-h-full max-w-full touch-none select-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            cursor: tool === "pan" ? "grab" : "crosshair",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Tool bar */}
      <div className="border-t border-white/10 px-2 py-2">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-1.5">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                tool === t.id ? "bg-primary text-primary-foreground" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/15" />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              className={`h-5 w-5 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-white/25"}`}
              style={{ background: c }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button
            onClick={() => setShapes((s) => s.slice(0, -1))}
            disabled={shapes.length === 0}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
          <button
            onClick={() => setShapes([])}
            disabled={shapes.length === 0}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
          {onSendToEdit && (
            <button
              onClick={() => { onSendToEdit(url); onClose(); }}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] text-white transition hover:bg-white/20"
            >
              <Pencil className="h-3.5 w-3.5" /> AI edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
