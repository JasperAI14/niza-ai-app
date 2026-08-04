import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, RefreshCw, Save, Music4, Loader2 } from "lucide-react";
import { toast } from "sonner";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function MusicPending({ label = "Generating music…" }: { label?: string }) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 p-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Music4 className="h-5 w-5" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-primary/20" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
          </div>
          <div className="mt-2 flex h-6 items-end gap-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <span
                key={i}
                className="w-[3px] animate-pulse rounded-full bg-primary/70"
                style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MusicCard({
  url,
  title,
  onRegenerate,
  regenerating,
  onSave,
  saving,
}: {
  url: string;
  title?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onSave?: () => void;
  saving?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCur(0);
  }, [url]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => toast.error("Could not play this track."));
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
    setCur(a.currentTime);
  }

  async function download() {
    try {
      const blob = await (await fetch(url, { mode: "cors" })).blob();
      const o = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = o;
      a.download = `${(title || "niza-track").replace(/[^\w-]+/g, "-").slice(0, 40)}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(o), 4000);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title || "Generated track"}</div>
          <input
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={Math.min(cur, dur || 0)}
            onChange={seek}
            aria-label="Seek"
            className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{fmt(cur)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-border/60 bg-background/40 px-2 py-1.5">
        <button
          onClick={download}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Download className="h-3 w-3" /> Download
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} /> Regenerate
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save to history
          </button>
        )}
      </div>
    </div>
  );
}
