import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Send, Trash2, MessageSquare, Menu, LogOut, Sparkles, Film, X, FileText, ImageIcon, Mic, MicOff, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  deleteThread as deleteThreadFn,
  getMe,
  getThreadMessages,
  listThreads,
  sendMessage,
  regenerateImage,
  regenerateText,
  type DBMessage,
} from "@/lib/chat.functions";
import { compressImage, isAcceptedImage, MAX_IMAGE_BYTES } from "@/lib/image-utils";
import { ChatMessage, type UIMessage } from "./ChatMessage";

const SAMPLES = [
  "Explain async/await in JavaScript",
  "Write a Python script to rename files",
  "Draft a marketing email for a new product",
  "A picture of a serene mountain lake at sunrise",
];

type Attachment =
  | { kind: "text"; name: string; text: string; progress: 100 }
  | { kind: "image"; name: string; dataUrl: string; bytes: number; progress: number; source?: "upload" | "edit" };

// Fetch a remote image URL and convert to data URL for round-trip editing.
async function urlToDataUrl(url: string): Promise<{ dataUrl: string; bytes: number }> {
  const r = await fetch(url, { mode: "cors" });
  if (!r.ok) throw new Error("Could not fetch image");
  const blob = await r.blob();
  const dataUrl: string = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
  return { dataUrl, bytes: blob.size };
}

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
  const regenTextFn = useServerFn(regenerateText);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<UIMessage[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_TEXT_FILE_BYTES = 1_000_000;
  const MAX_CHARS = 60_000;
  const MAX_IMAGES = 4;

  // ---------- Auto-grow textarea ----------
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [input]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const isImg = isAcceptedImage(f);
      if (isImg) {
        const currentImages = attachments.filter((a) => a.kind === "image").length;
        if (currentImages >= MAX_IMAGES) {
          toast.error(`You can attach up to ${MAX_IMAGES} images.`);
          continue;
        }
        if (f.size > 50 * 1024 * 1024) {
          toast.error(`${f.name} is too large to process (max 50MB source).`);
          continue;
        }
        const placeholderIdx = attachments.length;
        const placeholder: Attachment = { kind: "image", name: f.name, dataUrl: "", bytes: 0, progress: 0, source: "upload" };
        setAttachments((a) => [...a, placeholder]);
        try {
          const out = await compressImage(f, (pct) => {
            setAttachments((a) => a.map((it, i) => (i === placeholderIdx && it.kind === "image" ? { ...it, progress: pct } : it)));
          });
          if (out.bytes > MAX_IMAGE_BYTES) {
            toast.error(`${f.name} still exceeds 20MB after compression.`);
            setAttachments((a) => a.filter((_, i) => i !== placeholderIdx));
            continue;
          }
          setAttachments((a) => a.map((it, i) => (i === placeholderIdx && it.kind === "image"
            ? { kind: "image", name: out.name, dataUrl: out.dataUrl, bytes: out.bytes, progress: 100, source: "upload" }
            : it)));
        } catch (err) {
          toast.error(`Could not process ${f.name}: ${(err as Error).message}`);
          setAttachments((a) => a.filter((_, i) => i !== placeholderIdx));
        }
        continue;
      }
      if (f.size > MAX_TEXT_FILE_BYTES) {
        toast.error(`${f.name} is too large (max 1MB for text files).`);
        continue;
      }
      const isText = f.type.startsWith("text/") ||
        /\.(txt|md|markdown|json|csv|tsv|log|ya?ml|toml|ini|env|html?|css|scss|js|jsx|ts|tsx|py|rb|go|rs|java|c|cc|cpp|h|hpp|cs|php|sh|bash|zsh|sql|xml)$/i.test(f.name);
      if (!isText) {
        toast.error(`${f.name}: unsupported file type.`);
        continue;
      }
      try {
        const text = await f.text();
        setAttachments((a) => [...a, { kind: "text", name: f.name, text, progress: 100 }]);
      } catch {
        toast.error(`Could not read ${f.name}.`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((a) => a.filter((_, i) => i !== idx));
  }

  async function handleEditImage(url: string) {
    try {
      const { dataUrl, bytes } = await urlToDataUrl(url);
      setAttachments((a) => {
        const others = a.filter((x) => x.kind !== "image" || x.source !== "edit");
        return [...others, { kind: "image", name: "generated.png", dataUrl, bytes, progress: 100, source: "edit" }];
      });
      toast.success("Image ready — type your edit instructions.");
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      toast.error("Could not load image for editing.");
    }
  }

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => fetchThreads() });
  const messagesQ = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => fetchMessages({ data: { threadId: activeId! } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!activeId && threadsQ.data && threadsQ.data.length > 0) {
      setActiveId(threadsQ.data[0].id);
    }
  }, [threadsQ.data, activeId]);

  useEffect(() => {
    setOptimistic([]);
  }, [activeId, messagesQ.data]);

  const messages = useMemo<UIMessage[]>(() => {
    const base: UIMessage[] = (messagesQ.data ?? []).map((m: DBMessage) => ({
      id: m.id, role: m.role, content: m.content, image_url: m.image_url,
    }));
    return [...base, ...optimistic];
  }, [messagesQ.data, optimistic]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, optimistic.length]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [activeId]);

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
      setPendingDelete(null);
      toast.success("Chat deleted.");
    },
  });

  const sendMut = useMutation({
    mutationFn: async (payload: { content: string; images: string[]; isEdit: boolean }) => {
      let tid = activeId;
      if (!tid) {
        const t = await newThreadFn();
        qc.setQueryData(["threads"], (old: any) => [t, ...(old ?? [])]);
        setActiveId(t.id);
        tid = t.id;
      }
      const hasImages = payload.images.length > 0;
      const looksImage = payload.isEdit || (!hasImages && /\b(image|picture|photo|draw|paint|render|illustration|logo|wallpaper|poster|sketch|portrait|imagine|visualize)\b/i.test(payload.content));
      const userMsg: UIMessage = {
        id: "u-" + crypto.randomUUID(), role: "user", content: payload.content,
        image_url: hasImages ? payload.images[0] : null,
      };
      const pending: UIMessage = {
        id: "p-" + crypto.randomUUID(), role: "assistant", content: "",
        pending: looksImage ? "image" : "text",
      };
      setOptimistic([userMsg, pending]);
      const res = await sendFn({ data: { threadId: tid, content: payload.content, images: hasImages ? payload.images : undefined } });
      return { res, tid };
    },
    onSuccess: async ({ res, tid }) => {
      if (!res.ok && res.kind === "limit") {
        toast.error(res.message);
        setOptimistic([]);
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["messages", tid] }),
        qc.invalidateQueries({ queryKey: ["threads"] }),
        qc.invalidateQueries({ queryKey: ["me"] }),
      ]);
      setOptimistic([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
      setOptimistic([]);
    },
  });

  const regenMut = useMutation({
    mutationFn: (messageId: string) => regenFn({ data: { messageId } }),
    onSuccess: async (res) => {
      if (!res.ok) return toast.error(res.message ?? "Could not regenerate.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["messages", activeId] }),
        qc.invalidateQueries({ queryKey: ["me"] }),
      ]);
    },
    onError: () => toast.error("Image generation failed. Please try again later."),
  });

  const regenTextMut = useMutation({
    mutationFn: (messageId: string) => regenTextFn({ data: { messageId } }),
    onSuccess: async (res) => {
      if (!res.ok) return toast.error(res.message ?? "Could not regenerate.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["messages", activeId] }),
        qc.invalidateQueries({ queryKey: ["me"] }),
      ]);
    },
    onError: () => toast.error("Regeneration failed."),
  });

  const usage = meQ.data?.usage;
  useEffect(() => {
    if (!usage) return;
    const textPct = usage.text_count / usage.text_limit;
    const imgPct = usage.image_count / usage.image_limit;
    if (textPct >= 0.9 && textPct < 1) toast.warning(`Text usage at ${Math.round(textPct * 100)}%`);
    if (imgPct >= 0.9 && imgPct < 1) toast.warning(`Image usage at ${Math.round(imgPct * 100)}%`);
  }, [usage?.text_count, usage?.image_count]);

  async function handleSend() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || sendMut.isPending) return;
    const stillProcessing = attachments.some((a) => a.kind === "image" && a.progress < 100);
    if (stillProcessing) { toast.error("Please wait for image processing to finish."); return; }
    const images = attachments.filter((a): a is Extract<Attachment, { kind: "image" }> => a.kind === "image").map((a) => a.dataUrl);
    const isEdit = attachments.some((a) => a.kind === "image" && a.source === "edit");
    const texts = attachments.filter((a): a is Extract<Attachment, { kind: "text" }> => a.kind === "text");
    let combined = text;
    if (texts.length > 0) {
      let body = "";
      for (const a of texts) {
        const chunk = `\n\n--- Attached file: ${a.name} ---\n${a.text}\n--- end ${a.name} ---`;
        if (body.length + chunk.length > MAX_CHARS) { body += `\n\n[Additional attachments truncated to stay within size limit.]`; break; }
        body += chunk;
      }
      combined = `${text || "Please review the attached file(s)."}${body}`;
    } else if (!combined && images.length > 0) {
      combined = "Please analyze the attached image(s).";
    }
    setInput("");
    setAttachments([]);
    sendMut.mutate({ content: combined, images, isEdit });
  }

  // Enter creates a new line. Only Send button submits.
  function onKeyDown(_e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // no-op: send happens via the Send button
  }

  // ---------- Voice-to-text (Web Speech API) ----------
  function toggleMic() {
    if (typeof window === "undefined") return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input isn't supported in this browser."); return; }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    const baseText = input;
    let finalAppend = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalAppend += t + " ";
        else interim += t;
      }
      setInput(((baseText + " " + finalAppend + interim).trim().replace(/\s+/g, " ")));
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => { try { rec.stop(); } catch {} }, 3000);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch { toast.error("Couldn't start microphone."); }
  }

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // ---------- Long-press delete ----------
  function startPress(id: string) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setPendingDelete(id), 500);
  }
  function cancelPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
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

  const hasEditingImage = attachments.some((a) => a.kind === "image" && a.source === "edit");

  return (
    <div className="flex h-dvh w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-sidebar transition-transform md:static md:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">N</div>
            <span className="font-semibold">NovaMind AI</span>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${plan === "premium" ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"}`}>
            {plan.toUpperCase()}
          </span>
        </div>
        <button onClick={() => createMut.mutate()} className="m-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
          <Plus className="h-4 w-4" /> New chat
        </button>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {(threadsQ.data ?? []).map((t) => (
            <div
              key={t.id}
              onPointerDown={() => startPress(t.id)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); setPendingDelete(t.id); }}
              className={`group relative mb-1 flex select-none items-center gap-2 rounded-md px-2 py-2 text-sm ${t.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
            >
              <button
                onClick={() => { setActiveId(t.id); setSidebarOpen(false); }}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{t.title}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingDelete(t.id); }}
                className="opacity-60 transition-opacity hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Delete chat"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
              {pendingDelete === t.id && (
                <div className="absolute inset-x-1 top-full z-10 mt-1 rounded-lg border border-border bg-popover p-2 text-xs shadow-xl">
                  <div className="mb-2 px-1 font-medium">Delete this chat?</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => deleteMut.mutate(t.id)}
                      className="flex-1 rounded-md bg-destructive px-2 py-1.5 text-destructive-foreground hover:opacity-90"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setPendingDelete(null)}
                      className="flex-1 rounded-md border border-border px-2 py-1.5 hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

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

        <button onClick={signOut} className="m-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}

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
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/30">N</div>
              <h1 className="text-2xl font-semibold">How can I help you today?</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Chat, generate images, or upload a photo to analyze or edit.
              </p>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SAMPLES.map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="rounded-lg border border-border bg-card p-3 text-left text-sm hover:bg-accent">
                    <Sparkles className="mb-1 inline h-4 w-4 text-primary" />
                    <div>{s}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-3">
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  onRegenerate={(id) => regenMut.mutate(id)}
                  regenerating={regenMut.isPending && regenMut.variables === m.id}
                  onEditImage={handleEditImage}
                  onRegenerateText={(id) => regenTextMut.mutate(id)}
                />
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
          {hasEditingImage && (
            <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span>Editing image — type what to change (e.g. "remove the background", "make it anime style").</span>
            </div>
          )}
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 pr-2 text-xs">
                    {a.kind === "image" ? (
                      <>
                        {a.dataUrl ? (
                          <img src={a.dataUrl} alt={a.name} className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="max-w-[160px] truncate">{a.source === "edit" ? "Editing image" : a.name}</span>
                          {a.progress < 100 ? (
                            <div className="mt-0.5 h-1 w-32 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary transition-all" style={{ width: `${a.progress}%` }} />
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">{(a.bytes / 1024).toFixed(0)} KB · ready</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="max-w-[180px] truncate">{a.name}</span>
                      </>
                    )}
                    <button onClick={() => removeAttachment(i)} aria-label={`Remove ${a.name}`} className="ml-1">
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/60">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.txt,.md,.markdown,.json,.csv,.tsv,.log,.yaml,.yml,.toml,.ini,.env,.html,.htm,.css,.scss,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.cc,.cpp,.h,.hpp,.cs,.php,.sh,.bash,.zsh,.sql,.xml,text/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={sendMut.isPending || inputBlocked}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                aria-label="Attach files"
                title="Attach documents or images"
              >
                <Plus className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask NovaMind AI…"
                rows={1}
                className="max-h-60 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
                disabled={sendMut.isPending || inputBlocked}
              />
              <button
                onClick={toggleMic}
                disabled={sendMut.isPending || inputBlocked}
                title={listening ? "Stop listening" : "Voice input"}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-40 ${
                  listening
                    ? "border-primary bg-primary/15 text-primary shadow-[0_0_16px_-2px_rgba(155,80,255,0.6)]"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening && <span className="absolute inset-0 -z-10 animate-ping rounded-lg bg-primary/40" />}
              </button>
              <button
                onClick={handleSend}
                disabled={sendMut.isPending || (!input.trim() && attachments.length === 0) || inputBlocked}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition disabled:opacity-40 hover:opacity-90"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {listening && (
              <div className="mt-2 flex items-center justify-center gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:450ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:600ms]" />
                <span className="ml-2 text-[11px] text-muted-foreground">Listening…</span>
              </div>
            )}
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
            NovaMind AI can make mistakes. Verify important information.
          </p>
        </div>
      </main>
    </div>
  );
}
