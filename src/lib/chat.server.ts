// Server-only engine for Niza Prime AI: provider access, the intelligent AI Router,
// media generation and persistence helpers.
//
// Internal engine names are never exposed to end users:
//   Niza Chat 1.0   -> primary conversational engine
//   Niza Chat 1.1   -> secondary conversational engine
//   Niza Vision 2.0 -> image generation / editing
//   Niza Vision 2.1 -> image generation fallback
//   Niza Music 3.0  -> short instrumental pieces
//   Niza Music 3.1  -> full songs
import { NIZA_SYSTEM_PROMPT } from "@/lib/niza-knowledge";
import { LIMITS, TEXT_RESET_MS, IMAGE_RESET_MS, type Plan } from "./limits";
import { detectImageRequest, detectImageEdit, detectMusicRequest } from "./intent";

export type ProfileData = { plan: Plan; promo_used: boolean; email: string | null };

export type UsageData = {
  text_count: number;
  image_count: number;
  text_window_start: string;
  image_window_start: string;
  text_limit: number;
  image_limit: number;
};

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM_PROMPT = NIZA_SYSTEM_PROMPT;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Free accounts get this many un-watermarked images before the mark appears. */
export const FREE_CLEAN_IMAGES = 4;
const FREE_MEDIA_DELAY_MS = 10_000;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const mediaDelay = (isAdmin: boolean) => (isAdmin ? Promise.resolve() : sleep(FREE_MEDIA_DELAY_MS));

// ---------------- persistence helpers ----------------
export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadProfile(supabase: any, userId: string): Promise<ProfileData> {
  const { data } = await supabase
    .from("profiles")
    .select("plan, promo_used, email")
    .eq("id", userId)
    .maybeSingle();
  if (data) return data as ProfileData;
  const admin = await adminClient();
  await admin.from("profiles").insert({ id: userId });
  return { plan: "free", promo_used: false, email: null };
}

export async function loadOrResetUsage(supabase: any, userId: string, plan: Plan): Promise<UsageData> {
  const lim = LIMITS[plan];
  const { data } = await supabase
    .from("usage")
    .select("text_count, image_count, text_window_start, image_window_start")
    .eq("user_id", userId)
    .maybeSingle();
  const admin = await adminClient();
  if (!data) {
    await admin.from("usage").insert({ user_id: userId });
    const now = new Date().toISOString();
    return {
      text_count: 0,
      image_count: 0,
      text_window_start: now,
      image_window_start: now,
      text_limit: lim.text,
      image_limit: lim.image,
    };
  }
  const now = Date.now();
  const updates: Record<string, any> = {};
  let text_count = data.text_count;
  let image_count = data.image_count;
  let text_window_start = data.text_window_start;
  let image_window_start = data.image_window_start;
  if (now - new Date(data.text_window_start).getTime() >= TEXT_RESET_MS) {
    text_count = 0;
    text_window_start = new Date().toISOString();
    updates.text_count = 0;
    updates.text_window_start = text_window_start;
  }
  if (now - new Date(data.image_window_start).getTime() >= IMAGE_RESET_MS) {
    image_count = 0;
    image_window_start = new Date().toISOString();
    updates.image_count = 0;
    updates.image_window_start = image_window_start;
  }
  if (Object.keys(updates).length > 0) {
    await (admin as any).from("usage").update(updates).eq("user_id", userId);
  }
  return {
    text_count,
    image_count,
    text_window_start,
    image_window_start,
    text_limit: lim.text,
    image_limit: lim.image,
  };
}

const DEV_EMAILS = (process.env.ADMIN_EMAILS ?? "paschalsoromtochukwu@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function isAdminUser(supabase: any, userId: string, email: string | null): Promise<boolean> {
  if (email && DEV_EMAILS.includes(email.toLowerCase())) return true;
  try {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    return !!data;
  } catch {
    return false;
  }
}

// ---------------- encoding helpers ----------------
function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function dataUrlParts(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("bad data url");
  return { mimeType: m[1], data: m[2] };
}

// ---------------- Niza Chat 1.0 ----------------
async function nizaChat10(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error("niza-chat-1.0: no key");
  const attempts = [
    {
      url: "https://api.x.ai/v1/chat/completions",
      body: JSON.stringify({
        model: "grok-3",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
      }),
    },
    {
      url: "https://api.groq.com/openai/v1/chat/completions",
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
      }),
    },
  ];
  let lastErr: any = null;
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: a.body,
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content;
      if (!txt) throw new Error("empty");
      return txt;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("niza-chat-1.0 failed");
}

// ---------------- Niza Chat 1.1 ----------------
async function geminiGenerate(
  key: string,
  model: string,
  contents: any[],
  extra: Record<string, any> = {},
): Promise<any> {
  const r = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, ...extra }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${model} ${r.status} ${t.slice(0, 160)}`);
  }
  return r.json();
}

async function nizaChat11(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("niza-chat-1.1: no key");
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const j = await geminiGenerate(key, "gemini-2.5-flash", contents, {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  });
  const txt = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
  if (!txt) throw new Error("niza-chat-1.1 empty");
  return txt;
}

async function callLovableText(messages: ChatMsg[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no gateway key");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!r.ok) throw new Error(`gateway text ${r.status}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("gateway text empty");
  return txt;
}

async function callOpenRouterText(messages: ChatMsg[]): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("no openrouter key");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Niza Prime AI",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!r.ok) throw new Error(`openrouter ${r.status}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("openrouter empty");
  return txt;
}

async function callHuggingFaceText(messages: ChatMsg[]): Promise<string> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("no hf key");
  const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta-llama/Llama-3.1-8B-Instruct:novita",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!r.ok) throw new Error("hf " + r.status);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("hf empty");
  return txt;
}

export async function generateText(messages: ChatMsg[], extraSystem?: string): Promise<string> {
  const payload: ChatMsg[] = extraSystem?.trim()
    ? [{ role: "system", content: extraSystem.trim() }, ...messages]
    : messages;
  const providers: Array<[string, (m: ChatMsg[]) => Promise<string>]> = [
    ["niza-chat-1.0", nizaChat10],
    ["niza-chat-1.1", nizaChat11],
    ["gateway", callLovableText],
    ["openrouter", callOpenRouterText],
    ["hf", callHuggingFaceText],
  ];
  let lastErr: any = null;
  for (const [name, p] of providers) {
    try {
      return await p(payload);
    } catch (e) {
      lastErr = e;
      console.error(`[text] ${name} failed:`, (e as Error).message);
    }
  }
  throw lastErr ?? new Error("all text providers failed");
}

// ============================================================
// WEB SEARCH
// Time-sensitive questions are answered from live results and
// summarised normally. No engine or provider is ever named.
// ============================================================
export async function webSearchAnswer(
  question: string,
  extraSystem?: string,
): Promise<{ text: string; sources: Array<{ title: string; url: string }> }> {
  const key = process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const j = await geminiGenerate(
        key,
        "gemini-2.5-flash",
        [{ role: "user", parts: [{ text: question }] }],
        {
          tools: [{ google_search: {} }],
          systemInstruction: {
            parts: [{ text: `${SYSTEM_PROMPT}\n${extraSystem ?? ""}\nAnswer using the latest information available and state the date of anything time-sensitive.` }],
          },
        },
      );
      const cand = j?.candidates?.[0];
      const text = cand?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
      const sources: Array<{ title: string; url: string }> = [];
      for (const c of chunks) {
        const w = c?.web;
        if (w?.uri && !sources.some((s) => s.url === w.uri)) {
          sources.push({ title: w.title || w.uri, url: w.uri });
        }
      }
      if (text) return { text, sources: sources.slice(0, 5) };
    } catch (e) {
      console.error("[search] live lookup failed:", (e as Error).message);
    }
  }
  const text = await generateText([{ role: "user", content: question }], extraSystem);
  return {
    text: `${text}\n\n_I couldn't check live sources just now, so please verify anything time-sensitive._`,
    sources: [],
  };
}

// ============================================================
// INTELLIGENT AI ROUTER
// Deterministic knowledge-base rules win; only genuinely ambiguous
// wording costs a classifier call. Thin requests go to clarification.
// ============================================================
export type { RouteMode } from "./router-kb";


export type RouteDecision = {
  mode: RouteMode;
  prompt: string;
  source: "rules" | "kb" | "model" | "clarify";
  confidence: number;
  ratio?: AspectRatio;
  clarification?: { question: string; options: string[] };
};

const AMBIGUOUS =
  /\b(image|picture|photo|art|artwork|logo|poster|wallpaper|visual|song|music|track|beat|melody|tune|jingle|instrumental|draw|paint|illustrat|render)\w*\b/i;

const CODE_HINT =
  /\b(code|function|bug|error|stack\s*trace|compile|refactor|api|sql|regex|typescript|javascript|python|java|rust|golang|css|html|component|debug)\b/i;

async function routeWithModel(text: string): Promise<RouteMode | null> {
  const instruction = `Classify the user request into exactly one label and reply with the label only.
Labels: CHAT, CODE, IMAGE_GEN, MUSIC_SHORT, MUSIC_SONG, WEB_SEARCH.
IMAGE_GEN only when the user wants a NEW picture created.
MUSIC_SONG when they want a song with lyrics or vocals; MUSIC_SHORT for instrumentals, beats or melodies.
CODE when they want code written, explained, reviewed or debugged.
WEB_SEARCH when the answer depends on current, real-world, time-sensitive information.
Otherwise CHAT.

Request: ${text.slice(0, 600)}`;
  const attempts: Array<() => Promise<string>> = [
    () => callLovableText([{ role: "user", content: instruction }]),
    () => nizaChat10([{ role: "user", content: instruction }]),
  ];
  for (const attempt of attempts) {
    try {
      const raw = (await attempt()).toUpperCase();
      const found = (["IMAGE_GEN", "MUSIC_SONG", "MUSIC_SHORT", "WEB_SEARCH", "CODE", "CHAT"] as RouteMode[]).find(
        (l) => raw.includes(l),
      );
      if (found) return found;
    } catch (e) {
      console.error("[router] attempt failed:", (e as Error).message);
    }
  }
  return null;
}

export async function routeRequest(
  text: string,
  hasImages: boolean,
  opts: { skipClarify?: boolean; ratio?: AspectRatio; clarifyTurn?: number } = {},
): Promise<RouteDecision> {
  const content = (text ?? "").trim();

  // 1. Hard rules — an attachment decides the mode.
  if (hasImages) {
    return detectImageEdit(content)
      ? { mode: "IMAGE_EDIT", prompt: content, source: "rules", confidence: 1 }
      : { mode: "VISION", prompt: content, source: "rules", confidence: 1 };
  }

  // 2. Too thin to act on → one round of clarification (never billed).
  if (!opts.skipClarify && needsClarification(content)) {
    return {
      mode: "CLARIFY",
      prompt: content,
      source: "clarify",
      confidence: 1,
      clarification: buildClarification(content, opts.clarifyTurn ?? 0),
    };
  }

  // 3. Knowledge-base match.
  const kb = matchKnowledgeBase(content);
  if (kb && kb.confidence >= 0.8) {
    return {
      mode: kb.mode,
      prompt: content,
      source: "kb",
      confidence: kb.confidence,
      ...(kb.mode === "IMAGE_GEN" ? { ratio: opts.ratio ?? inferAspectRatio(content) } : {}),
    };
  }

  // 4. Model classification only for the ambiguous middle band.
  if (AMBIGUOUS.test(content) && content.length <= 600) {
    const mode = await routeWithModel(content);
    if (mode && mode !== "CHAT") {
      return {
        mode,
        prompt: content,
        source: "model",
        confidence: 0.7,
        ...(mode === "IMAGE_GEN" ? { ratio: opts.ratio ?? inferAspectRatio(content) } : {}),
      };
    }
  }

  // 5. Fall back to the knowledge-base weak match, then conversation.
  if (kb) return { mode: kb.mode, prompt: content, source: "kb", confidence: kb.confidence };
  return {
    mode: CODE_HINT.test(content) ? "CODE" : "CHAT",
    prompt: content,
    source: "rules",
    confidence: 0.6,
  };
}


// ---------------- Vision (analysis) ----------------
export async function nizaVisionAnalyze(text: string, images: string[]): Promise<string> {
  const key = process.env.GeminiphotoAPI || process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const parts: any[] = [{ text: text || "Please analyse the attached image(s)." }];
      for (const url of images) parts.push({ inlineData: dataUrlParts(url) });
      const j = await geminiGenerate(key, "gemini-2.5-flash", [{ role: "user", parts }], {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      });
      const txt = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
      if (txt) return txt;
    } catch (e) {
      console.error("[vision] primary failed:", (e as Error).message);
    }
  }
  const lkey = process.env.LOVABLE_API_KEY;
  if (!lkey) throw new Error("vision unavailable");
  const content: any[] = [{ type: "text", text: text || "Please analyse the attached image(s)." }];
  for (const url of images) content.push({ type: "image_url", image_url: { url } });
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lkey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content }],
    }),
  });
  if (!r.ok) throw new Error(`vision gateway ${r.status}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("vision empty");
  return typeof txt === "string" ? txt : JSON.stringify(txt);
}

// ---------------- Niza Vision 2.0 / 2.1 ----------------
function extractInlineImage(j: any): ArrayBuffer {
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p?.inlineData?.data ?? p?.inline_data?.data;
    if (d) return b64ToBuffer(d);
  }
  throw new Error("no image in response");
}

async function nizaVision20(prompt: string, inputImages: string[] = []): Promise<ArrayBuffer> {
  const key = process.env.GeminiphotoAPI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("niza-vision-2.0: no key");
  const parts: any[] = [{ text: prompt }];
  for (const url of inputImages) parts.push({ inlineData: dataUrlParts(url) });
  const j = await geminiGenerate(key, "gemini-2.5-flash-image", [{ role: "user", parts }], {
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  return extractInlineImage(j);
}

async function nizaVision21(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("niza-vision-2.1: no key");
  const endpoints = [
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
  ];
  let lastErr: any = null;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "image/png" },
        body: JSON.stringify({ inputs: prompt }),
      });
      if (!r.ok) {
        lastErr = new Error(`hf ${r.status}`);
        continue;
      }
      return await r.arrayBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("niza-vision-2.1 failed");
}

async function nizaVision21Edit(prompt: string, imageDataUrl: string): Promise<ArrayBuffer> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("niza-vision-2.1: no key");
  const { data } = dataUrlParts(imageDataUrl);
  const r = await fetch(
    "https://api-inference.huggingface.co/models/diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "image/png" },
      body: JSON.stringify({ inputs: prompt, image: data }),
    },
  );
  if (!r.ok) throw new Error(`hf inpaint ${r.status}`);
  return r.arrayBuffer();
}

async function gatewayGptImage(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no gateway key");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2", prompt, size: "1024x1024", quality: "low", n: 1 }),
  });
  if (!r.ok) throw new Error(`gateway gpt-image ${r.status}`);
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("gateway gpt-image empty");
  return b64ToBuffer(b64);
}

async function gatewayGeminiImage(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no gateway key");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`gateway gemini-image ${r.status}`);
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("gateway gemini-image empty");
  return b64ToBuffer(b64);
}

async function callStability(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.STABILITY_API_KEY;
  if (!key) throw new Error("no stability");
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  form.append("aspect_ratio", "1:1");
  const r = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
    body: form,
  });
  if (!r.ok) throw new Error(`stability ${r.status}`);
  return r.arrayBuffer();
}

export async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const providers: Array<[string, (p: string) => Promise<ArrayBuffer>]> = [
    ["niza-vision-2.0", (p) => nizaVision20(p)],
    ["gateway-gpt-image", gatewayGptImage],
    ["gateway-gemini-image", gatewayGeminiImage],
    ["niza-vision-2.1", nizaVision21],
    ["stability", callStability],
  ];
  let lastErr: any = null;
  for (const [name, fn] of providers) {
    try {
      return await fn(prompt);
    } catch (e) {
      lastErr = e;
      console.error(`[image] ${name} failed:`, (e as Error).message);
    }
  }
  throw lastErr ?? new Error("all image providers failed");
}

async function gatewayImageEdit(prompt: string, imageDataUrls: string[]): Promise<ArrayBuffer> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no gateway key");
  const content: any[] = [{ type: "text", text: prompt }];
  for (const url of imageDataUrls) content.push({ type: "image_url", image_url: { url } });
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`gateway image-edit ${r.status}`);
  const j = await r.json();
  const msg = j?.choices?.[0]?.message;
  let dataUrl: string | undefined;
  if (Array.isArray(msg?.images) && msg.images[0]?.image_url?.url) dataUrl = msg.images[0].image_url.url;
  else if (Array.isArray(msg?.content)) {
    const blk = msg.content.find((c: any) => c?.type === "image_url" || c?.image_url);
    dataUrl = blk?.image_url?.url;
  }
  if (!dataUrl) throw new Error("gateway image-edit empty");
  if (dataUrl.startsWith("data:")) return b64ToBuffer(dataUrl.split(",")[1]);
  const imgR = await fetch(dataUrl);
  if (!imgR.ok) throw new Error("image-edit fetch " + imgR.status);
  return imgR.arrayBuffer();
}

export async function editImage(prompt: string, imageDataUrls: string[]): Promise<ArrayBuffer> {
  const providers: Array<[string, () => Promise<ArrayBuffer>]> = [
    ["niza-vision-2.0", () => nizaVision20(prompt, imageDataUrls)],
    ["gateway", () => gatewayImageEdit(prompt, imageDataUrls)],
    ["niza-vision-2.1", () => nizaVision21Edit(prompt, imageDataUrls[0])],
  ];
  let lastErr: any = null;
  for (const [name, fn] of providers) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.error(`[image-edit] ${name} failed:`, (e as Error).message);
    }
  }
  throw lastErr ?? new Error("image editing failed");
}

// ---------------- Niza Music 3.0 / 3.1 ----------------
function extractAudio(j: any): { buf: ArrayBuffer; mime: string } | null {
  const pred = j?.predictions?.[0];
  const predB64 = pred?.audioContent ?? pred?.bytesBase64Encoded ?? pred?.audio;
  if (typeof predB64 === "string" && predB64.length > 100) {
    return { buf: b64ToBuffer(predB64), mime: pred?.mimeType ?? "audio/wav" };
  }
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p?.inlineData ?? p?.inline_data;
    if (inline?.data && String(inline.mimeType ?? inline.mime_type ?? "").startsWith("audio")) {
      return { buf: b64ToBuffer(inline.data), mime: inline.mimeType ?? inline.mime_type };
    }
  }
  return null;
}

export async function nizaMusic(
  prompt: string,
  tier: "short" | "song",
): Promise<{ buf: ArrayBuffer; mime: string }> {
  const key = process.env.GeminimusicAPI || process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("niza-music: no key");
  const model = tier === "song" ? "lyria-3-pro-preview" : "lyria-3-preview";
  const attempts: Array<{ url: string; body: any }> = [
    {
      url: `${GEMINI_BASE}/models/${model}:predict?key=${key}`,
      body: {
        instances: [{ prompt }],
        parameters: { sampleCount: 1, ...(tier === "short" ? { durationSeconds: 30 } : {}) },
      },
    },
    {
      url: `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`,
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["AUDIO"] },
      },
    },
  ];
  let lastErr: any = null;
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a.body),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`${model} ${r.status} ${t.slice(0, 160)}`);
      }
      const j = await r.json();
      const out = extractAudio(j);
      if (!out) throw new Error(`${model} returned no audio`);
      return out;
    } catch (e) {
      lastErr = e;
      console.error("[music] attempt failed:", (e as Error).message);
    }
  }
  throw lastErr ?? new Error("niza-music failed");
}

// ---------------- titles ----------------
export function deriveTitle(text: string) {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  return t.length > 48 ? t.slice(0, 48) + "…" : t || "New chat";
}

export async function smartTitle(userText: string, assistantText: string): Promise<string> {
  try {
    const raw = await generateText([
      {
        role: "user",
        content: `Write a short chat title (3 to 6 words, Title Case, no quotes, no punctuation at the end) that summarises this conversation.\n\nUser: ${userText.slice(0, 800)}\n\nAssistant: ${assistantText.slice(0, 400)}\n\nReply with the title only.`,
      },
    ]);
    const cleaned = raw
      .replace(/["'`*#]/g, "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (cleaned && cleaned.length >= 3 && cleaned.length <= 60) return cleaned.replace(/[.:;,]+$/, "");
  } catch (e) {
    console.error("[title] failed:", (e as Error).message);
  }
  return deriveTitle(userText);
}
