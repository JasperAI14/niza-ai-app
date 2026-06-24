import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Download, RefreshCw, ImageIcon, Loader2 } from "lucide-react";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  pending?: "text" | "image" | null;
};

export function ChatMessage({
  message,
  onRegenerate,
  regenerating,
}: {
  message: UIMessage;
  onRegenerate?: (id: string) => void;
  regenerating?: boolean;
}) {
  const isUser = message.role === "user";
  const isPendingImage = message.pending === "image";
  const isPendingText = message.pending === "text";
  const canRegenerate = !isUser && !!message.image_url && !message.id.startsWith("p-") && !!onRegenerate;

  return (
    <div className={`w-full px-4 py-3 ${isUser ? "" : "bg-muted/30"}`}>
      <div className={`mx-auto flex max-w-3xl gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
            isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
          }`}
        >
          {isUser ? "U" : "N"}
        </div>
        <div className={`min-w-0 flex-1 ${isUser ? "text-right" : ""}`}>
          <div
            className={`inline-block max-w-full rounded-2xl px-4 py-2 text-sm ${
              isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
            } prose prose-sm dark:prose-invert prose-pre:my-2 prose-pre:bg-transparent prose-pre:p-0 ${
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
                        <SyntaxHighlighter style={oneDark as any} language={match[1]} PreTag="div" customStyle={{ borderRadius: 8, margin: 0 }}>
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
              <div className="mt-2 text-left">
                <div className="overflow-hidden rounded-lg border border-border bg-background">
                  <img src={message.image_url} alt="Generated" className="block max-w-full" />
                  <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3 w-3" /> AI image
                    </span>
                    <div className="flex items-center gap-1">
                      {canRegenerate && (
                        <button
                          onClick={() => onRegenerate!(message.id)}
                          disabled={regenerating}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                          Regenerate
                        </button>
                      )}
                      <a
                        href={message.image_url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Download className="h-3 w-3" /> Download
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
