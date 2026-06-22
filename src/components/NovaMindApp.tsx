import { useEffect, useMemo, useRef, useState } from "react";
import {
  deriveTitle,
  loadThreads,
  newThread,
  saveThreads,
  type ChatMessage as Msg,
  type Thread,
} from "@/lib/chat-store";
import { ChatMessage } from "./ChatMessage";
import { Plus, Send, Trash2, Image as ImageIcon, MessageSquare, Menu } from "lucide-react";

function initialState(): { threads: Thread[]; activeId: string } {
  const existing = loadThreads();
  if (existing.length > 0) {
    return { threads: existing, activeId: existing[0].id };
  }
  const t = newThread();
  return { threads: [t], activeId: t.id };
}

export function NovaMindApp() {
  const [{ threads, activeId }, setState] = useState<{
    threads: Thread[];
    activeId: string;
  }>(() => {
    if (typeof window === "undefined") {
      const t = newThread();
      return { threads: [t], activeId: t.id };
    }
    return initialState();
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, loading]);

  function updateActive(updater: (t: Thread) => Thread) {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === s.activeId ? updater(t) : t)),
    }));
  }

  function createThread() {
    const t = newThread();
    setState((s) => ({ threads: [t, ...s.threads], activeId: t.id }));
    setSidebarOpen(false);
  }

  function selectThread(id: string) {
    setState((s) => ({ ...s, activeId: id }));
    setSidebarOpen(false);
  }

  function deleteThread(id: string) {
    setState((s) => {
      const remaining = s.threads.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const t = newThread();
        return { threads: [t], activeId: t.id };
      }
      const activeId = s.activeId === id ? remaining[0].id : s.activeId;
      return { threads: remaining, activeId };
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !active) return;
    setInput("");
    setLoading(true);

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    const isImage = /^(generate image:|\/image\s+|imagine\s+)/i.test(text);
    const prompt = text.replace(/^(generate image:|\/image\s+|imagine\s+)/i, "").trim();

    const baseMessages = [...active.messages, userMsg];
    updateActive((t) => ({
      ...t,
      messages: baseMessages,
      title: t.messages.length === 0 ? deriveTitle(text) : t.title,
      updatedAt: Date.now(),
    }));

    try {
      if (isImage) {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        const assistant: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.image ? `Here's your image for: *${prompt}*` : (data.error ?? "Image generation failed. Please try again."),
          image: data.image,
          createdAt: Date.now(),
        };
        updateActive((t) => ({ ...t, messages: [...baseMessages, assistant], updatedAt: Date.now() }));
      } else {
        const history = baseMessages.map((m) => ({ role: m.role, content: m.content }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = await res.json();
        const assistant: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply ?? data.error ?? "AI is currently unavailable. Please try again.",
          createdAt: Date.now(),
        };
        updateActive((t) => ({ ...t, messages: [...baseMessages, assistant], updatedAt: Date.now() }));
      }
    } catch {
      const assistant: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "AI is currently unavailable. Please try again.",
        createdAt: Date.now(),
      };
      updateActive((t) => ({ ...t, messages: [...baseMessages, assistant], updatedAt: Date.now() }));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-dvh w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar transition-transform md:static md:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              N
            </div>
            <span className="font-semibold">NovaMind AI</span>
          </div>
        </div>
        <button
          onClick={createThread}
          className="m-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                t.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() => selectThread(t.id)}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{t.title}</span>
              </button>
              <button
                onClick={() => deleteThread(t.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete chat"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          Tip: start a message with <code className="rounded bg-muted px-1">generate image:</code> to create images.
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">NovaMind AI</span>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
                N
              </div>
              <h1 className="text-2xl font-semibold">How can I help you today?</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Chat, code, debug, or generate images. Try asking a question or start with{" "}
                <code className="rounded bg-muted px-1">generate image: a neon city at night</code>.
              </p>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  "Explain async/await in JavaScript",
                  "Write a Python script to rename files",
                  "Debug: why is my React state not updating?",
                  "generate image: a serene mountain lake at sunrise",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:bg-accent"
                  >
                    {s.startsWith("generate image:") && (
                      <ImageIcon className="mb-1 inline h-4 w-4 text-primary" />
                    )}
                    <div>{s}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {active.messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {loading && (
                <div className="w-full bg-muted/30 py-6">
                  <div className="mx-auto flex max-w-3xl gap-4 px-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-semibold">
                      AI
                    </div>
                    <div className="flex items-center gap-1 pt-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background p-3 md:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message NovaMind AI…"
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition disabled:opacity-40 hover:opacity-90"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
            NovaMind AI can make mistakes. Verify important information.
          </p>
        </div>
      </main>
    </div>
  );
}
