// Hidden memory for Niza Prime AI.
//
// Stores durable facts about a user (preferences, language, profession,
// ongoing projects) so answers stay personal across conversations.
// Nothing sensitive is ever stored: a redaction filter runs before every write
// and matching content is dropped silently and never logged.

export type MemoryRow = { id: string; key: string; value: string; kind: string; updated_at: string };

const MAX_ROWS = 40;
const MAX_VALUE = 240;

// Anything matching these is never stored, and its presence poisons the whole
// candidate fact so partial credentials cannot leak through.
const FORBIDDEN: RegExp[] = [
  /\b(password|passcode|passphrase|pin\s*code|otp|one[-\s]?time\s*code|verification\s*code|2fa|mfa)\b/i,
  /\b(api[-\s]?key|secret[-\s]?key|access[-\s]?token|refresh[-\s]?token|bearer|private[-\s]?key|credential)\b/i,
  /\b(card\s*number|cvv|cvc|expiry|iban|swift|routing\s*number|account\s*number|bvn|sort\s*code)\b/i,
  /\b(ssn|social\s*security|passport|national\s*id|nin|driver'?s?\s*licen[cs]e)\b/i,
  /\b(diagnos|medical|prescription|hiv|pregnan|therapy|mental\s*health)\w*/i,
  /\b(home\s*address|lives?\s+at|residing\s+at|street|apartment\s*\d)\b/i,
  /\bsk-[A-Za-z0-9_-]{8,}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // e-mail addresses
  /\b(?:\d[ -]?){13,19}\b/, // card-like number runs
  /https?:\/\/\S*(token|secret|key|invite|reset)\S*/i,
];

export function isSafeMemory(key: string, value: string): boolean {
  const blob = `${key} ${value}`;
  if (!value.trim() || value.length > MAX_VALUE) return false;
  return !FORBIDDEN.some((re) => re.test(blob));
}

/** Compact stored facts into a short block for the system prompt. */
export async function loadMemoryBlock(supabase: any, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("user_memory")
      .select("key, value")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS);
    const rows = (data ?? []) as Array<{ key: string; value: string }>;
    if (!rows.length) return "";
    const lines = rows.map((r) => `- ${r.key}: ${r.value}`).join("\n");
    return `Private notes about this user (never list these back, never mention that you remember unless asked directly, and use them only when relevant):\n${lines}`;
  } catch {
    return "";
  }
}

type Candidate = { key: string; value: string; kind: string };

/**
 * Ask the language model whether the latest exchange contains a durable fact.
 * Runs in the background; failures are silent by design.
 */
export async function extractMemories(
  generate: (messages: Array<{ role: "user" | "assistant"; content: string }>) => Promise<string>,
  userText: string,
  assistantText: string,
): Promise<Candidate[]> {
  const instruction = `Extract durable long-term facts about the USER from this exchange.
Only include: lasting preferences, tone or style preferences, their name, profession, preferred language, projects they are working on, repeated workflows, stated likes and dislikes.
NEVER include: passwords, API keys, tokens, secret links, payment or card details, bank details, OTP or verification codes, ID or passport numbers, health details, home addresses, e-mail addresses, or anything the user asked to keep private or forget.
If there is nothing durable, reply with exactly [].
Reply with JSON only: [{"key":"short_snake_case_key","value":"short fact","kind":"preference|profile|project|style"}]

USER: ${userText.slice(0, 1500)}
ASSISTANT: ${assistantText.slice(0, 600)}`;

  try {
    const raw = await generate([{ role: "user", content: instruction }]);
    const json = /\[[\s\S]*\]/.exec(raw)?.[0];
    if (!json) return [];
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c: any) => c && typeof c.key === "string" && typeof c.value === "string")
      .map((c: any) => ({
        key: String(c.key).toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 48),
        value: String(c.value).trim().slice(0, MAX_VALUE),
        kind: ["preference", "profile", "project", "style"].includes(c.kind) ? c.kind : "preference",
      }))
      .filter((c: Candidate) => c.key && isSafeMemory(c.key, c.value))
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Upsert by key so a changed fact overwrites the old one, then prune. */
export async function saveMemories(admin: any, userId: string, candidates: Candidate[]): Promise<void> {
  if (!candidates.length) return;
  try {
    const now = new Date().toISOString();
    await admin.from("user_memory").upsert(
      candidates.map((c) => ({ user_id: userId, key: c.key, value: c.value, kind: c.kind, updated_at: now })),
      { onConflict: "user_id,key" },
    );
    const { data } = await admin
      .from("user_memory")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    const rows = (data ?? []) as Array<{ id: string }>;
    if (rows.length > MAX_ROWS) {
      const stale = rows.slice(MAX_ROWS).map((r) => r.id);
      await admin.from("user_memory").delete().in("id", stale);
    }
  } catch {
    // memory is best-effort; never surface or log the content
  }
}
