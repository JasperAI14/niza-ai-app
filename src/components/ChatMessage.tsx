import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, Loader2, Copy, Share2, Pencil, Check, Download, Maximize2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isReusableContent, shouldUseCopyCard } from "@/lib/intent";
import { CopyCard } from "./CopyCard";
import { CodeBlock } from "./CodeBlock";
import { ImageViewer } from "./ImageViewer";
import { downloadImageWithWatermark } from "@/lib/watermark";
import { YouTubeEmbed } from "./YouTubeEmbed";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  media_model?: string | null;
  media_prompt?: string | null;
  watermarked?: boolean;
  edited?: boolean;
  created_at?: string;
  pending?: "text" | "image" | "video" | null;
};

async function nativeShare(text: string, url?: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url });
      return;
    }
  } catch {
    return; /* user cancelled */
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Sharing not supported on this device.");
  }
}

export const markdownComponents = {
  img({ src, alt, ...props }: any) {
    return (
      <img
        {...props}
        src={String(src)}
        alt={alt ?? "image result"}
        loading="lazy"
        className="max-h-64 w-auto rounded-xl border border-border"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  },
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const raw = String(children).replace(/\n$/, "");
    if (!inline && (match || raw.includes("\n"))) {
      return <CodeBlock code={raw} lang={match?.[1] ?? "text"} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export function ChatMessage({
  message,
  onRegenerate,
  regenerating,
  onEditImage,
  onRegenerateText,
  onLongPress,
  onEditVideo,
  imageGenerating,
  onRetryImage,
  userPrompt,
}: {
  userPrompt?: string | null;
  imageGenerating?: boolean;
  onRetryImage?: (m: UIMessage) => void;
  message: UIMessage;
  onRegenerate?: (id: string) => void;
  regenerating?: boolean;
  onEditImage?: (url: string) => void;
  onRegenerateText?: (id: string) => void;
  onLongPress?: (m: UIMessage) => void;
  onEditVideo?: (url: string) => void;
}) {
  const isUser = message.role === "user";
  const puterState = !message.image_url && message.media_model?.startsWith("puter-")
    ? message.media_model.startsWith("puter-failed") && !imageGenerating
      ? "failed"
      : "pending"
    : null;
  const isPending = !!message.pending || !!puterState;
  const isPersisted = !message.id.startsWith("p-") && !message.id.startsWith("u-");
  const hasMedia = !!message.image_url || !!message.audio_url || !!message.video_url;
  const videoMarkers = !isUser
    ? [...message.content.matchAll(/\[NIZA-VIDEO url="([^"]+)"(?: live="(\d)")?\]([\s\S]*?)\[\/NIZA-VIDEO\]/g)].map((m) => ({
        url: m[1],
        live: m[2] === "1",
        title: m[3],
      }))
    : [];
  const bodyText = videoMarkers.length
    ? message.content.replace(/\[NIZA-VIDEO[\s\S]*?\[\/NIZA-VIDEO\]/g, "").trim()
    : message.content;
  const useCopyCard = !isUser && !isPending && !hasMedia && shouldUseCopyCard(bodyText || message.content, userPrompt);
  const showCopy = !isUser && !isPending && !hasMedia && !useCopyCard && isReusableContent(bodyText || message.content);
  const showRegenText = !isUser && !isPending && !hasMedia && !!onRegenerateText && isPersisted;
  const canRegenerateImg = !isUser && !!message.image_url && isPersisted && !!onRegenerate;
  const [copied, setCopied] = useState(false);
  const [viewer, setViewer] = useState(false);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(bodyText || message.content);
      setCopied(true);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed.");
    }
  }

  const pressProps = onLongPress
    ? {
        onPointerDown: () => {
          pressTimer = setTimeout(() => onLongPress(message), 500);
        },
        onPointerUp: () => pressTimer && clearTimeout(pressTimer),
        onPointerLeave: () => pressTimer && clearTimeout(pressTimer),
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault();
          onLongPress(message);
        },
      }
    : {};

  return (
    <div className="w-full px-3 py-1 sm:px-4">
      <div className={`mx-auto flex max-w-3xl ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`flex min-w-0 flex-col gap-1 ${
            useCopyCard || hasMedia ? "w-full max-w-full sm:max-w-[88%]" : isUser ? "max-w-[80%] sm:max-w-[70%]" : "max-w-full sm:max-w-[92%]"
          } ${isUser ? "items-end" : "items-start"}`}
          {...pressProps}
        >
          {/* ---- Pending states ---- */}
          {message.pending === "video" ? (
            <div className="flex w-full max-w-sm items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{message.content || "Editing your video…"}</span>
            </div>
          ) : puterState === "failed" ? (
            <div className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-center">
              <span className="text-xs text-muted-foreground">{message.content || "Image generation failed."}</span>
              {onRetryImage && (
                <button
                  onClick={() => onRetryImage(message)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              )}
            </div>
          ) : message.pending === "image" || puterState === "pending" ? (
            <div className="h-56 w-56 shrink-0">
              <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-muted/40">
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/60 via-muted/20 to-muted/60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Generating image…</span>
                </div>
              </div>
            </div>
          ) : message.pending === "text" ? (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking…</span>
            </div>
          ) : useCopyCard ? (
            <CopyCard content={message.content} />
          ) : (
            <>
              {/* ---- Text body ---- */}
              {bodyText && (
                <div
                  className={`break-words leading-relaxed ${
                    isUser
                      ? "inline-block rounded-2xl rounded-br-md bg-primary px-3 py-1.5 text-[14px] text-primary-foreground"
                      : "text-[15px] text-foreground"
                  } prose prose-sm max-w-none dark:prose-invert prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-p:my-1.5 prose-headings:my-2 ${
                    isUser ? "prose-invert prose-p:my-0.5" : ""
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {bodyText}
                  </ReactMarkdown>
                </div>
              )}

              {/* ---- Found videos (live search) ---- */}
              {videoMarkers.map((v, i) => (
                <YouTubeEmbed key={i} url={v.url} title={v.title} live={v.live} />
              ))}

              {/* ---- Image ---- */}
              {message.image_url && (
                <button
                  onClick={() => setViewer(true)}
                  className="group relative mt-1 inline-block max-w-[min(280px,100%)] overflow-hidden rounded-2xl border border-border bg-background"
                  aria-label="Open image full screen"
                >
                  <img src={message.image_url} alt="Generated" className="block h-auto max-h-[360px] w-auto max-w-full object-contain" loading="lazy" />
                  {message.watermarked && (
                    <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] font-semibold text-white/75 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]">
                      Niza Prime AI
                    </span>
                  )}
                  <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/45 p-1 opacity-0 transition group-hover:opacity-100">
                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                  </span>
                </button>
              )}

              {/* ---- Video ---- */}
              {message.video_url && (
                <div className="mt-1 w-full max-w-md">
                  {/\.gif(\?|$)/i.test(message.video_url) ? (
                    <img src={message.video_url} alt="Edited GIF" className="block w-full rounded-2xl border border-border" />
                  ) : (
                    <video
                      src={message.video_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="block max-h-[60vh] w-full rounded-2xl border border-border bg-foreground/5"
                    />
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {onEditVideo && isPersisted && (
                      <Action onClick={() => onEditVideo(message.video_url!)} label="Edit video">
                        <Pencil className="h-3 w-3" />
                      </Action>
                    )}
                    <Action
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = message.video_url!;
                        a.download = /\.gif(\?|$)/i.test(message.video_url!) ? "niza-edit.gif" : "niza-edit.mp4";
                        a.target = "_blank";
                        a.click();
                      }}
                      label="Download"
                    >
                      <Download className="h-3 w-3" />
                    </Action>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---- Action bar ---- */}
          {!isUser && !isPending && (showCopy || showRegenText || message.image_url) && (
            <div className="flex flex-wrap items-center gap-1">
              {showCopy && (
                <Action onClick={copyText} label={copied ? "Copied" : "Copy"}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Action>
              )}
              {message.image_url && (
                <Action onClick={() => onEditImage?.(message.image_url!)} label="Edit">
                  <Pencil className="h-3 w-3" />
                </Action>
              )}
              {canRegenerateImg && (
                <Action onClick={() => onRegenerate!(message.id)} label="Regenerate" disabled={regenerating}>
                  <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                </Action>
              )}
              {showRegenText && (
                <Action onClick={() => onRegenerateText!(message.id)} label="Regenerate">
                  <RefreshCw className="h-3 w-3" />
                </Action>
              )}
              {message.image_url && (
                <Action
                  onClick={() => downloadImageWithWatermark(message.image_url!, !!message.watermarked)}
                  label="Download"
                >
                  <Download className="h-3 w-3" />
                </Action>
              )}
              <Action onClick={() => nativeShare(message.content, message.image_url ?? undefined)} label="Share">
                <Share2 className="h-3 w-3" />
              </Action>
            </div>
          )}

          {message.edited && (
            <span className="px-1 text-[10px] text-muted-foreground">edited</span>
          )}
        </div>
      </div>

      {viewer && message.image_url && (
        <ImageViewer
          url={message.image_url}
          watermarked={message.watermarked}
          onClose={() => setViewer(false)}
          onSendToEdit={onEditImage}
        />
      )}
    </div>
  );
}

function Action({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      {children}
      {label}
    </button>
  );
}
