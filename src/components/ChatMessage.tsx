import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, Loader2, Copy, Share2, Pencil, Check, Download, Maximize2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isReusableContent, shouldUseCopyCard } from "@/lib/intent";
import { CopyCard } from "./CopyCard";
import { CodeBlock } from "./CodeBlock";
import { ImageViewer } from "./ImageViewer";
import { MusicCard, MusicPending } from "./MusicCard";
import { downloadImageWithWatermark } from "@/lib/watermark";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  audio_url?: string | null;
  watermarked?: boolean;
  edited?: boolean;
  created_at?: string;
  pending?: "text" | "image" | "music" | null;
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
  onSaveMusic,
  onLongPress,
}: {
  message: UIMessage;
  onRegenerate?: (id: string) => void;
  regenerating?: boolean;
  onEditImage?: (url: string) => void;
  onRegenerateText?: (id: string) => void;
  onSaveMusic?: (id: string) => void;
  onLongPress?: (m: UIMessage) => void;
}) {
  const isUser = message.role === "user";
  const isPending = !!message.pending;
  const isPersisted = !message.id.startsWith("p-") && !message.id.startsWith("u-");
  const hasMedia = !!message.image_url || !!message.audio_url;
  const useCopyCard = !isUser && !isPending && !hasMedia && shouldUseCopyCard(message.content);
  const showCopy = !isUser && !isPending && !hasMedia && !useCopyCard && isReusableContent(message.content);
  const showRegenText = !isUser && !isPending && !hasMedia && !!onRegenerateText && isPersisted;
  const canRegenerateImg = !isUser && !!message.image_url && isPersisted && !!onRegenerate;
  const [copied, setCopied] = useState(false);
  const [viewer, setViewer] = useState(false);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(message.content);
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
          {message.pending === "music" ? (
            <MusicPending />
          ) : message.pending === "image" ? (
            <div className="w-full max-w-sm">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted/40">
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
              {message.content && (
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
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* ---- Image ---- */}
              {message.image_url && (
                <button
                  onClick={() => setViewer(true)}
                  className="group relative mt-1 block w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background"
                  aria-label="Open image full screen"
                >
                  <img src={message.image_url} alt="Generated" className="block w-full" loading="lazy" />
                  {message.watermarked && (
                    <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] font-semibold text-white/75 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]">
                      NovaMind AI
                    </span>
                  )}
                  <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/45 p-1 opacity-0 transition group-hover:opacity-100">
                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                  </span>
                </button>
              )}

              {/* ---- Music ---- */}
              {message.audio_url && (
                <div className="mt-1 w-full">
                  <MusicCard
                    url={message.audio_url}
                    onSave={onSaveMusic && isPersisted ? () => onSaveMusic(message.id) : undefined}
                    onRegenerate={onRegenerate && isPersisted ? () => onRegenerate(message.id) : undefined}
                    regenerating={regenerating}
                  />
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
