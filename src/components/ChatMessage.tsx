import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ChatMessage as Msg } from "@/lib/chat-store";

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  return (
    <div className={`w-full py-6 ${isUser ? "" : "bg-muted/30"}`}>
      <div className="mx-auto flex max-w-3xl gap-4 px-4">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
            isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
          }`}
        >
          {isUser ? "You" : "AI"}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {message.image && (
            <div className="space-y-2">
              <img
                src={message.image}
                alt="Generated"
                className="max-w-full rounded-lg border border-border"
              />
              <a
                href={message.image}
                download={`novamind-${message.id}.png`}
                className="inline-block text-xs text-primary hover:underline"
              >
                Download image
              </a>
            </div>
          )}
          {message.content && (
            <div className="prose prose-invert max-w-none prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-p:leading-relaxed">
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
                          customStyle={{
                            borderRadius: 8,
                            margin: 0,
                            fontSize: 13,
                          }}
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code
                        className="rounded bg-muted px-1.5 py-0.5 text-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
