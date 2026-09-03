import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ProfileRow } from "./ProfileRow";
import {
  deleteThread as deleteThreadFn,
  listThreads,
  renameThread as renameThreadFn,
  searchMessages,
  setThreadPinned,
  type DBThread,
} from "@/lib/chat.functions";
import { initializePremiumCheckout } from "@/lib/paystack.functions";

type Usage = {
  text_count: number;
  image_count: number;
  text_limit: number;
  image_limit: number;
} | null;

type Props = {
  open: boolean;
  onClose: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  plan: "free" | "premium" | string;
  usage: Usage;
};

export function ChatSidebar({ open, onClose, activeId, onSelect, onNewChat, plan, usage }: Props) {
  const qc = useQueryClient();
  const fetchThreads = useServerFn(listThreads);
  const removeThreadFn = useServerFn(deleteThreadFn);
  const renameFn = useServerFn(renameThreadFn);
  const pinFn = useServerFn(setThreadPinned);
  const searchFn = useServerFn(searchMessages);
  const checkoutFn = useServerFn(initializePremiumCheckout);

  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => fetchThreads() });
  const threads = (threadsQ.data ?? []) as DBThread[];

  const pinned = useMemo(() => threads.filter((t) => t.pinned), [threads]);
  const recent = useMemo(() => threads.filter((t) => !t.pinned), [threads]);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuFor]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeThreadFn({ data: { threadId: id } }),
    onSuccess: (_d, id) => {
      qc.setQueryData(["threads"], (old: any) => (old ?? []).filter((t: any) => t.id !== id));
      setConfirmDelete(null);
      if (activeId === id) onNewChat();
      toast.success("Chat deleted.");
    },
    onError: () => toast.error("Could not delete this chat."),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; title: string }) =>
      renameFn({ data: { threadId: v.id, title: v.title } }),
    onSuccess: (_d, v) => {
      qc.setQueryData(["threads"], (old: any) =>
        (old ?? []).map((t: any) => (t.id === v.id ? { ...t, title: v.title } : t)),
      );
      setRenamingId(null);
    },
    onError: () => toast.error("Could not rename this chat."),
  });

  const pinMut = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) =>
      pinFn({ data: { threadId: v.id, pinned: v.pinned } }),
    onSuccess: (_d, v) => {
      qc.setQueryData(["threads"], (old: any) =>
        (old ?? []).map((t: any) => (t.id === v.id ? { ...t, pinned: v.pinned } : t)),
      );
    },
    onError: () => toast.error("Could not update this chat."),
  });

  function startPress(id: string) {
    cancelPress();
    pressTimer.current = setTimeout(() => setMenuFor(id), 480);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  async function startUpgrade() {
    setUpgrading(true);
    try {
      const res = await checkoutFn({ data: { callbackUrl: `${window.location.origin}/upgrade/callback` } });
      if (!res.ok) {
        toast.error(res.message);
        setUpgrading(false);
        return;
      }
      window.location.href = res.authorizationUrl;
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setUpgrading(false);
    }
  }

  function renderItem(t: DBThread) {
    const active = t.id === activeId;
    return (
      <div key={t.id} className="relative">
        {renamingId === t.id ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = renameValue.trim();
              if (v) renameMut.mutate({ id: t.id, title: v.slice(0, 80) });
              else setRenamingId(null);
            }}
            className="mb-0.5 px-1"
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => setRenamingId(null)}
              className="w-full rounded-md border border-primary/50 bg-card px-2 py-1.5 text-sm outline-none"
            />
          </form>
        ) : (
          <button
            onPointerDown={() => startPress(t.id)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuFor(t.id);
            }}
            onClick={() => {
              onSelect(t.id);
              onClose();
            }}
            className={`mb-0.5 flex w-full select-none items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
              active ? "bg-accent font-medium text-accent-foreground" : "hover:bg-accent/60"
            }`}
          >
            {t.pinned ? (
              <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            )}
            <span className="truncate">{t.title}</span>
          </button>
        )}

        {menuFor === t.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-popover text-sm shadow-xl"
          >
            {confirmDelete === t.id ? (
              <div className="p-2">
                <div className="px-1 pb-2 text-xs font-medium">Delete this chat?</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => deleteMut.mutate(t.id)}
                    className="flex-1 rounded-md bg-destructive px-2 py-1.5 text-xs text-destructive-foreground hover:opacity-90"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDelete(null);
                      setMenuFor(null);
                    }}
                    className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-1">
                <MenuRow
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  label="Rename"
                  onClick={() => {
                    setRenameValue(t.title);
                    setRenamingId(t.id);
                    setMenuFor(null);
                  }}
                />
                <MenuRow
                  icon={t.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  label={t.pinned ? "Unpin" : "Pin"}
                  onClick={() => {
                    pinMut.mutate({ id: t.id, pinned: !t.pinned });
                    setMenuFor(null);
                  }}
                />
                <MenuRow
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label="Delete"
                  destructive
                  onClick={() => setConfirmDelete(t.id)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <aside
        className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <BrandLogo size={26} />
          <span className="truncate text-sm font-semibold tracking-tight">Niza Prime AI</span>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              plan === "premium" ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"
            }`}
          >
            {String(plan).toUpperCase()}
          </span>
        </div>

        <div className="space-y-1 px-2 pb-2">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm font-medium hover:bg-accent"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Search className="h-4 w-4" /> Search chats
          </button>
        </div>

        {/* Lists */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {pinned.length > 0 && (
            <>
              <SectionLabel>Pinned</SectionLabel>
              {pinned.map(renderItem)}
              <div className="my-2 h-px bg-border" />
            </>
          )}
          {threads.length > 0 && <SectionLabel>Chats</SectionLabel>}
          {recent.map(renderItem)}
          {threads.length === 0 && !threadsQ.isLoading && (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">No conversations yet.</p>
          )}
        </div>

        {/* Usage */}
        {usage && (
          <div className="border-t border-border px-3 py-2.5 text-xs">
            <div className="mb-1.5 font-medium text-muted-foreground">Credits</div>
            <UsageRow label="chats" used={usage.text_count} limit={usage.text_limit} />
            <UsageRow label="images" used={usage.image_count} limit={usage.image_limit} />
          </div>
        )}

        {plan !== "premium" && (
          <div className="px-3 pb-2">
            <button
              onClick={startUpgrade}
              disabled={upgrading}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-60"
            >
              {upgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Upgrade to Premium
            </button>
          </div>
        )}

        <ProfileRow />
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} />}

      {searchOpen && (
        <SearchDialog
          onClose={() => setSearchOpen(false)}
          search={(q) => searchFn({ data: { q } })}
          onPick={(id) => {
            onSelect(id);
            setSearchOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent ${
        destructive ? "text-destructive" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="mb-1.5">
      <div className="mb-1 flex justify-between">
        <span className="text-muted-foreground">
          {Math.max(0, limit - used)} / {limit} {label}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SearchDialog({
  onClose,
  search,
  onPick,
}: {
  onClose: () => void;
  search: (q: string) => Promise<any>;
  onPick: (threadId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ threads: any[]; messages: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRes(null);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        setRes(await search(term));
      } catch {
        setRes(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search conversations"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all conversations and messages"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button onClick={onClose} aria-label="Close search">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!res && <p className="px-2 py-3 text-xs text-muted-foreground">Type to search your chat history.</p>}
          {res && res.threads.length === 0 && res.messages.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No matches found.</p>
          )}
          {res?.threads.length ? (
            <>
              <SectionLabel>Conversations</SectionLabel>
              {res.threads.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </>
          ) : null}
          {res?.messages.length ? (
            <>
              <SectionLabel>Messages</SectionLabel>
              {res.messages.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => onPick(m.thread_id)}
                  className="block w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
                >
                  <span className="line-clamp-2 text-muted-foreground">{m.content}</span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
