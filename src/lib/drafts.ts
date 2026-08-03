// Auto-saved composer drafts, per chat thread. Survives reloads and crashes.

const KEY = "novamind.drafts.v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type Draft = {
  text: string;
  updatedAt: number;
  /** Where the text came from — used to label recovered voice drafts. */
  source?: "typing" | "voice";
};

type Store = Record<string, Draft>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(parsed)) {
      if (!parsed[k]?.text?.trim() || now - (parsed[k].updatedAt ?? 0) > MAX_AGE_MS) {
        delete parsed[k];
        changed = true;
      }
    }
    if (changed) write(parsed);
    return parsed;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode */
  }
}

const slot = (threadId?: string | null) => threadId || "__new__";

export function saveDraft(threadId: string | null | undefined, text: string, source: Draft["source"] = "typing") {
  if (typeof window === "undefined") return;
  const store = read();
  if (!text.trim()) delete store[slot(threadId)];
  else store[slot(threadId)] = { text, updatedAt: Date.now(), source };
  write(store);
}

export function loadDraft(threadId: string | null | undefined): Draft | null {
  return read()[slot(threadId)] ?? null;
}

export function clearDraft(threadId: string | null | undefined) {
  if (typeof window === "undefined") return;
  const store = read();
  delete store[slot(threadId)];
  write(store);
}

/** Move the "new chat" draft onto a thread once the thread is created. */
export function promoteNewChatDraft(threadId: string) {
  const store = read();
  const d = store["__new__"];
  if (!d) return;
  delete store["__new__"];
  store[threadId] = d;
  write(store);
}
