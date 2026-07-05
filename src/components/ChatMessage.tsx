import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Download, RefreshCw, Loader2, Copy, Share2, Pencil, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isReusableContent, shouldUseCopyCard } from "@/lib/intent";
import { CopyCard } from "./CopyCard";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  pending?: "text" | "image" | null;
};

async function downloadImage(url: string, filename = "novamind.png") {
  try {
    const r = await fetch(url, { mode: "cors" });
    const blob = await r.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

async function nativeShare(text: string, url?: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url });
      return;
    }
  } catch {
    /* user cancelled */
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Sharing not supported on this device.");
  }
}

export function ChatMessage({
  message,
  onRegenerate,
  regenerating,
  onEditImage,
  onRegenerateText,
}: {
  message: UIMessage;
  onRegenerate?: (id: string) => void;
  regenerating?: boolean;
  onEditImage?: (url: string) => void;
  onRegenerateText?: (id: string) => void;
}) {
  const isUser = message.role === "user";
  const isPendingImage = message.pending === "image";
  const isPendingText = message.pending === "text";
  const isPending = isPendingImage || isPendingText;
  const isPersisted = !message.id.startsWith("p-") && !message.id.startsWith("u-");
  const useCopyCard = !isUser && !isPending && !message.image_url && shouldUseCopyCard(message.content);
  const showCopy = !isUser && !isPending && !message.image_url && !useCopyCard && isReusableContent(message.content);
  const showRegenText = !isUser && !isPending && !message.image_url && !!onRegenerateText && isPersisted;
  const canRegenerateImg = !isUser && !!message.image_url && isPersisted && !!onRegenerate;
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="w-full px-3 py-1.5 sm:px-4">
      <div className={`mx-auto flex max-w-3xl ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`min-w-0 ${useCopyCard ? "w-full max-w-full sm:max-w-[85%]" : "max-w-[85%] sm:max-w-[75%]"} ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}
        >
          {useCopyCard ? (
            <CopyCard content={message.content} />
          ) : (
          <div
            className={`inline-block rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed break-words ${
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card text-card-foreground border border-border/50 rounded-bl-md"
            } prose prose-sm dark:prose-invert max-w-none prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-p:my-1.5 prose-headings:my-2 ${
              isUser ? "prose-invert" : ""
            }`}
          >
            {isPendingImage ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating image…</span>
              </div>
            ) : isPendingText ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking…</span>
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    if (!inline && match) {
                      return (
                        <SyntaxHighlighter style={oneDark as any} language={match[1]} PreTag="div" customStyle={{ borderRadius: 8, margin: 0, fontSize: 13 }}>
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
            {message.image_url && (
              <div className="mt-2">
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <img src={message.image_url} alt="Generated" className="block max-w-full" />
                </div>
              </div>
            )}
          </div>
          )}

          {/* Action bar */}
          {!isUser && !isPending && (showCopy || showRegenText || message.image_url) && (
            <div className={`flex flex-wrap items-center gap-1 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
              {showCopy && (
                <button
                  onClick={copyText}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Copy message"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              {message.image_url && (
                <button
                  onClick={() => onEditImage?.(message.image_url!)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
              {canRegenerateImg && (
                <button
                  onClick={() => onRegenerate!(message.id)}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} /> Regenerate
                </button>
              )}
              {showRegenText && (
                <button
                  onClick={() => onRegenerateText!(message.id)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </button>
              )}
              {message.image_url && (
                <button
                  onClick={() => downloadImage(message.image_url!)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              )}
              <button
                onClick={() => nativeShare(message.content, message.image_url ?? undefined)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Share2 className="h-3 w-3" /> Share
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
