import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Download } from "lucide-react";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
};

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
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
            {message.image_url && (
              <div className="mt-2 text-left">
                <img src={message.image_url} alt="Generated" className="max-w-full rounded-lg" />
                <a
                  href={message.image_url}
                  download
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
