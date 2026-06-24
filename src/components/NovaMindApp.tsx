import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Send, Trash2, MessageSquare, Menu, LogOut, Sparkles, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread as deleteThreadFn,
  getMe,
  getThreadMessages,
  listThreads,
  sendMessage,
  regenerateImage,
  type DBMessage,
} from "@/lib/chat.functions";
import { detectImageRequest } from "@/lib/intent";
import { ChatMessage, type UIMessage } from "./ChatMessage";

const SAMPLES = [
  "Explain async/await in JavaScript",
  "Write a Python script to rename files",
  "Debug: why isn't my React state updating?",
  "A picture of a serene mountain lake at sunrise",
];

export function NovaMindApp() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchThreads = useServerFn(listThreads);
  const fetchMe = useServerFn(getMe);
  const fetchMessages = useServerFn(getThreadMessages);
  const newThreadFn = useServerFn(createThread);
  const removeThreadFn = useServerFn(deleteThreadFn);
  const sendFn = useServerFn(sendMessage);
  const regenFn = useServerFn(regenerateImage);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<UIMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => fetchThreads() });
  const messagesQ = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => fetchMessages({ data: { threadId: activeId! } }),
    enabled: !!activeId,
  });

  // Pick first thread by default
  useEffect(() => {
    if (!activeId && threadsQ.data && threadsQ.data.length > 0) {
      setActiveId(threadsQ.data[0].id);
    }
  }, [threadsQ.data, activeId]);

  // Reset optimistic when thread changes / server data lands
  useEffect(() => {
    setOptimistic([]);
  }, [activeId, messagesQ.data]);

  const messages = useMemo<UIMessage[]>(() => {
    const base: UIMessage[] = (messagesQ.data ?? []).map((m: DBMessage) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      image_url: m.image_url,
    }));
    return [...base, ...optimistic];
  }, [messagesQ.data, optimistic]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const createMut = useMutation({
    mutationFn: () => newThreadFn(),
    onSuccess: (t) => {
      qc.setQueryData(["threads"], (old: any) => [t, ...(old ?? [])]);
      setActiveId(t.id);
      setSidebarOpen(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeThreadFn({ data: { threadId: id } }),
    onSuccess: (_d, id) => {
      qc.setQueryData(["threads"], (old: any) => (old ?? []).filter((t: any) => t.id !== id));
      if (activeId === id) setActiveId(null);
    },
  });

  const sendMut = useMutation({
    mutationFn: async (content: string) => {
      let tid = activeId;
      if (!tid) {
        const t = await newThreadFn();
        qc.setQueryData(["threads"], (old: any) => [t, ...(old ?? [])]);
        setActiveId(t.id);
        tid = t.id;
      }
      const isImage = !!detectImageRequest(content);
      const userMsg: UIMessage = { id: "u-" + crypto.randomUUID(), role: "user", content };
      const pending: UIMessage = {
        id: "p-" + crypto.randomUUID(),
        role: "assistant",
        content: "",
        pending: isImage ? "image" : "text",
      };
      setOptimistic([userMsg, pending]);
      const res = await sendFn({ data: { threadId: tid, content } });
      return { res, tid };
    },
    onSuccess: async ({ res, tid }) => {
      if (!res.ok && res.kind === "limit") {
        toast.error(res.message);
        setOptimistic([]);
        return;
      }
      // refresh messages, threads (title may have changed), and usage
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["messages", tid] }),
        qc.invalidateQueries({ queryKey: ["threads"] }),
        qc.invalidateQueries({ queryKey: ["me"] }),
      ]);
      setOptimistic([]);
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
      setOptimistic([]);
    },
  });

  // Usage warnings
  const usage = meQ.data?.usage;
  useEffect(() => {
    if (!usage) return;
    const textPct = usage.text_count / usage.text_limit;
    const imgPct = usage.image_count / usage.image_limit;
    if (textPct >= 0.9 && textPct < 1) toast.warning(`Text usage at ${Math.round(textPct * 100)}%`);
    else if (textPct >= 0.7 && textPct < 0.9) toast(`Heads up: text usage at ${Math.round(textPct * 100)}%`);
    if (imgPct >= 0.9 && imgPct < 1) toast.warning(`Image usage at ${Math.round(imgPct * 100)}%`);
  }, [usage?.text_count, usage?.image_count]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sendMut.isPending) return;
    setInput("");
    sendMut.mutate(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const plan = meQ.data?.profile.plan ?? "free";
  const textPct = usage ? Math.min(100, Math.round((usage.text_count / usage.text_limit) * 100)) : 0;
  const imgPct = usage ? Math.min(100, Math.round((usage.image_count / usage.image_limit) * 100)) : 0;
  const textBlocked = !!usage && usage.text_count >= usage.text_limit;
  const imgBlocked = !!usage && usage.image_count >= usage.image_limit;
  const inputBlocked = textBlocked && imgBlocked;

  function barColor(pct: number) {
    if (pct >= 100) return "bg-destructive";
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-primary";
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
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${plan === "premium" ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"}`}>
            {plan.toUpperCase()}
          </span>
        </div>
        <button
          onClick={() => createMut.mutate()}
          className="m-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {(threadsQ.data ?? []).map((t) => (
            <div
              key={t.id}
              className={`group mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                t.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() => {
                  setActiveId(t.id);
                  setSidebarOpen(false);
                }}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{t.title}</span>
              </button>
              <button
                onClick={() => deleteMut.mutate(t.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete chat"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>

        {/* Usage panel */}
        {usage && (
          <div className="space-y-2 border-t border-border p-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-muted-foreground">Text</span>
                <span className="font-medium">{usage.text_count} / {usage.text_limit}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full transition-all ${barColor(textPct)}`} style={{ width: `${textPct}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span className="text-muted-foreground">Images</span>
                <span className="font-medium">{usage.image_count} / {usage.image_limit}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full transition-all ${barColor(imgPct)}`} style={{ width: `${imgPct}%` }} />
              </div>
            </div>
            {plan === "premium" && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-muted-foreground">
                <Film className="h-3.5 w-3.5" />
                <span>AI Video — Coming soon</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={signOut}
          className="m-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
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
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
                N
              </div>
              <h1 className="text-2xl font-semibold">How can I help you today?</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask me anything — code, ideas, explanations, or describe a picture you'd like me to create.
              </p>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:bg-accent"
                  >
                    <Sparkles className="mb-1 inline h-4 w-4 text-primary" />
                    <div>{s}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background p-3 md:p-4">
          {inputBlocked && (
            <div className="mx-auto mb-2 max-w-3xl rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
              You've reached your usage limit. It will reset automatically.
            </div>
          )}
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message NovaMind AI…"
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              disabled={sendMut.isPending || inputBlocked}
            />
            <button
              onClick={handleSend}
              disabled={sendMut.isPending || !input.trim() || inputBlocked}
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
