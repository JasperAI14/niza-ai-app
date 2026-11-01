import { ExternalLink } from "lucide-react";

/** Extracts a YouTube video id from the URL forms users paste. */
export function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/i.exec(url);
  return m ? m[1] : null;
}

/**
 * Plays a YouTube video inside the app with the official player. Some videos
 * and live streams can't be embedded — a clear "Watch on YouTube" fallback
 * link is always shown underneath.
 */
export function YouTubeEmbed({ url, title, live }: { url: string; title?: string; live?: boolean }) {
  const id = youtubeId(url);
  const label = title ? title.replace(/[[\]]/g, "") : "Video";

  if (!id) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 flex w-full max-w-md items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-3 hover:bg-accent"
      >
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">
          <ExternalLink className="h-3 w-3" /> Watch on YouTube
        </span>
      </a>
    );
  }

  return (
    <div className="mt-1 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${id}?rel=0`}
          title={label || "Video player"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
          loading="lazy"
        />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {live && <span className="mr-1 inline-flex items-center gap-1 font-semibold text-red-500">● Live</span>}
          {label}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Watch on YouTube
        </a>
      </div>
    </div>
  );
}
