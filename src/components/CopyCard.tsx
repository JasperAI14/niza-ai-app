import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Share2, Check, X, FileText, Code2, BookOpen, MessageSquareQuote, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { copyCardTitle } from "@/lib/intent";

// Map fenced-code language → file extension. Falls back to .txt.
const LANG_EXT: Record<string, string> = {
  javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx",
  python: "py", py: "py", ruby: "rb", rb: "rb", go: "go", rust: "rs", rs: "rs",
  java: "java", kotlin: "kt", swift: "swift", c: "c", cpp: "cpp", "c++": "cpp",
  cs: "cs", csharp: "cs", php: "php", sh: "sh", bash: "sh", zsh: "sh",
  html: "html", css: "css", scss: "scss", json: "json", yaml: "yml", yml: "yml",
  toml: "toml", xml: "xml", sql: "sql", md: "md", markdown: "md", tex: "tex",
};

function detectFilename(content: string, title: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const codeMatch = /```(\w+)?/.exec(content);
  if (title === "Code" && codeMatch) {
    const ext = LANG_EXT[(codeMatch[1] || "").toLowerCase()] || "txt";
    return `niza-${stamp}.${ext}`;
  }
  if (title === "Guide" || /^#{1,3}\s/m.test(content)) return `niza-${stamp}.md`;
  if (title === "Prompt") return `niza-prompt-${stamp}.txt`;
  return `niza-${stamp}.txt`;
}

function downloadText(content: string, filename: string) {
  // If Code with a single fenced block, download just the code body.
  let body = content;
  const single = /^```(?:\w+)?\n([\s\S]*?)```\s*$/.exec(content.trim());
  if (single && filename.endsWith(".js") === false && !filename.endsWith(".md") && !filename.endsWith(".txt")) {
    body = single[1];
  } else if (single && !filename.endsWith(".md") && !filename.endsWith(".txt")) {
    body = single[1];
  }
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function nativeShare(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch {
    // user cancelled — treat as no-op
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Sharing not supported on this device.");
  }
}

function iconFor(title: string) {
  if (title === "Code") return Code2;
  if (title === "Guide") return BookOpen;
  if (title === "Prompt") return MessageSquareQuote;
  return FileText;
}

export function CopyCard({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const title = copyCardTitle(content);
  const Icon = iconFor(title);
  const preview = content.split("\n").filter(Boolean).slice(0, 3).join("\n").slice(0, 220);
  const words = content.trim().split(/\s+/).filter(Boolean).length;

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(e?: React.MouseEvent) {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed.");
    }
  }
  function share(e?: React.MouseEvent) {
    e?.stopPropagation();
    nativeShare(content);
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        className="group w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        aria-label={`Open ${title}`}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="text-[11px] text-muted-foreground">{words.toLocaleString()} words · tap to open</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
        </div>
        <div className="px-3 py-2.5">
          <div className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">
            {preview}
          </div>
        </div>
        <div className="flex items-center gap-1 border-t border-border/60 bg-background/40 px-2 py-1.5">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Copy"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={share}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Share"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadText(content, detectFilename(content, title));
              toast.success("File downloaded.");
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Download"
          >
            <Download className="h-3 w-3" /> Download
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="text-[11px] text-muted-foreground">{words.toLocaleString()} words</div>
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:bg-accent"
              aria-label="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadText(content, detectFilename(content, title));
                toast.success("File downloaded.");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:bg-accent"
              aria-label="Download"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={share}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:bg-accent"
              aria-label="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border transition hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
            <div className="prose prose-sm mx-auto max-w-3xl dark:prose-invert prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-p:my-2 prose-headings:my-3">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    if (!inline && match) {
                      return (
                        <SyntaxHighlighter
                          style={oneDark as any}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: 8, margin: 0, fontSize: 13 }}
                        >
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
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
