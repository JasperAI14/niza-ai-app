import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITS, TEXT_RESET_MS, IMAGE_RESET_MS, type Plan } from "./limits";
import { detectImageRequest, detectImageEdit, detectMusicRequest } from "./intent";

// ---------- types ----------
export type DBMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  audio_url?: string | null;
  watermarked?: boolean;
  edited?: boolean;
  created_at: string;
};

export type DBThread = { id: string; title: string; updated_at: string };

export type ProfileData = {
  plan: Plan;
  promo_used: boolean;
  email: string | null;
};

export type UsageData = {
  text_count: number;
  image_count: number;
  text_window_start: string;
  image_window_start: string;
  text_limit: number;
  image_limit: number;
};

// ---------- helpers (server only, inside handlers) ----------
async function loadProfile(supabase: any, userId: string): Promise<ProfileData> {
  const { data } = await supabase
    .from("profiles")
    .select("plan, promo_used, email")
    .eq("id", userId)
    .maybeSingle();
  if (data) return data as ProfileData;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("profiles").insert({ id: userId });
  return { plan: "free", promo_used: false, email: null };
}

async function loadOrResetUsage(supabase: any, userId: string, plan: Plan): Promise<UsageData> {
  const lim = LIMITS[plan];
  const { data } = await supabase
    .from("usage")
    .select("text_count, image_count, text_window_start, image_window_start")
    .eq("user_id", userId)
    .maybeSingle();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!data) {
    await supabaseAdmin.from("usage").insert({ user_id: userId });
    return {
      text_count: 0,
      image_count: 0,
      text_window_start: new Date().toISOString(),
      image_window_start: new Date().toISOString(),
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
    await (supabaseAdmin as any).from("usage").update(updates).eq("user_id", userId);
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

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ============================================================
// NOVA MODEL ROUTING
// Internal engine names are never exposed to end users.
//   Nova Chat 1.0   -> Grok (xAI)                  [GROK_API_KEY]
//   Nova Chat 1.1   -> Gemini 2.5 Flash            [GeminichatAPI]
//   Nova Vision 2.0 -> Gemini 2.5 Flash Image      [GeminiphotoAPI]
//   Nova Vision 2.1 -> FLUX.1 / SDXL Inpainting    [HUGGINGFACE_API_KEY]
//   Nova Music 3.0  -> lyria-3-preview             [GeminimusicAPI]
//   Nova Music 3.1  -> lyria-3-pro-preview         [GeminimusicAPI]
// Lovable AI Gateway is kept as a silent last-resort fallback.
// ============================================================

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
const SYSTEM_PROMPT = `You are NovaMind AI, a helpful, friendly, capable assistant. Excellent at conversation, coding, debugging, tutoring, and problem solving. Format code in fenced markdown blocks with language tags. Be concise but thorough. Never reveal the names of underlying model providers or model IDs.`;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function dataUrlParts(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("bad data url");
  return { mimeType: m[1], data: m[2] };
}

// ---------------- Nova Chat 1.0 (Grok / xAI) ----------------
async function novaChat10(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error("nova-chat-1.0: no key");
  const body = JSON.stringify({
    model: "grok-3",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.7,
  });
  // xAI first; some deployments provision this key against the Groq API instead.
  const attempts: Array<{ url: string; body: string }> = [
    { url: "https://api.x.ai/v1/chat/completions", body },
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
  throw lastErr ?? new Error("nova-chat-1.0 failed");
}

// ---------------- Nova Chat 1.1 (Gemini 2.5 Flash) ----------------
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

async function novaChat11(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("nova-chat-1.1: no key");
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const j = await geminiGenerate(key, "gemini-2.5-flash", contents, {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  });
  const txt = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
  if (!txt) throw new Error("nova-chat-1.1 empty");
  return txt;
}

// ---------------- Text fallbacks ----------------
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

async function callOpenRouterText(messages: ChatMsg[]): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("no openrouter key");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pixel-text-ai.lovable.app",
      "X-Title": "NovaMind AI",
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

async function callLovableText(messages: ChatMsg[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no lovable key");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!r.ok) throw new Error(`lovable text ${r.status}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("lovable text empty");
  return txt;
}

async function generateText(messages: ChatMsg[]): Promise<string> {
  const providers: Array<[string, (m: ChatMsg[]) => Promise<string>]> = [
    ["nova-chat-1.0", novaChat10],
    ["nova-chat-1.1", novaChat11],
    ["gateway", callLovableText],
    ["openrouter", callOpenRouterText],
    ["hf", callHuggingFaceText],
  ];
  let lastErr: any = null;
  for (const [name, p] of providers) {
    try {
      return await p(messages);
    } catch (e) {
      lastErr = e;
      console.error(`[text] ${name} failed:`, (e as Error).message);
    }
  }
  throw lastErr ?? new Error("all text providers failed");
}

// ---------------- Vision (analysis) ----------------
async function novaVisionAnalyze(text: string, images: string[]): Promise<string> {
  const key = process.env.GeminiphotoAPI || process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const parts: any[] = [{ text: text || "Please analyze the attached image(s)." }];
      for (const url of images) parts.push({ inlineData: dataUrlParts(url) });
      const j = await geminiGenerate(key, "gemini-2.5-flash", [{ role: "user", parts }], {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      });
      const txt = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
      if (txt) return txt;
    } catch (e) {
      console.error("[vision] gemini failed:", (e as Error).message);
    }
  }
  const lkey = process.env.LOVABLE_API_KEY;
  if (!lkey) throw new Error("vision unavailable");
  const content: any[] = [{ type: "text", text: text || "Please analyze the attached image(s)." }];
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

// ---------------- Nova Vision 2.0 (Gemini image) ----------------
function extractInlineImage(j: any): ArrayBuffer {
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = p?.inlineData?.data ?? p?.inline_data?.data;
    if (d) return b64ToBuffer(d);
  }
  throw new Error("no image in response");
}

async function novaVision20(prompt: string, inputImages: string[] = []): Promise<ArrayBuffer> {
  const key = process.env.GeminiphotoAPI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("nova-vision-2.0: no key");
  const parts: any[] = [{ text: prompt }];
  for (const url of inputImages) parts.push({ inlineData: dataUrlParts(url) });
  const j = await geminiGenerate(key, "gemini-2.5-flash-image", [{ role: "user", parts }], {
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  return extractInlineImage(j);
}

// ---------------- Nova Vision 2.1 (FLUX.1 / SDXL Inpainting) ----------------
async function novaVision21(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("nova-vision-2.1: no key");
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
  throw lastErr ?? new Error("nova-vision-2.1 failed");
}

// SDXL inpainting / image-to-image editing fallback.
async function novaVision21Edit(prompt: string, imageDataUrl: string): Promise<ArrayBuffer> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("nova-vision-2.1: no key");
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

// ---------------- Gateway image fallbacks ----------------
async function gatewayGptImage(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no lovable key");
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
  if (!key) throw new Error("no lovable key");
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

async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const providers: Array<[string, (p: string) => Promise<ArrayBuffer>]> = [
    ["nova-vision-2.0", (p) => novaVision20(p)],
    ["gateway-gpt-image", gatewayGptImage],
    ["gateway-gemini-image", gatewayGeminiImage],
    ["nova-vision-2.1", novaVision21],
    ["stability", callStability],
  ];
  let lastErr: any = null;
  for (const [name, fn] of providers) {
    try {
      const buf = await fn(prompt);
      console.log(`[image] ${name} ok`);
      return buf;
    } catch (e) {
      lastErr = e;
      console.error(`[image] ${name} failed:`, (e as Error).message);
    }
  }
  throw lastErr ?? new Error("all image providers failed");
}

async function gatewayImageEdit(prompt: string, imageDataUrls: string[]): Promise<ArrayBuffer> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no lovable key");
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

async function editImage(prompt: string, imageDataUrls: string[]): Promise<ArrayBuffer> {
  const providers: Array<[string, () => Promise<ArrayBuffer>]> = [
    ["nova-vision-2.0", () => novaVision20(prompt, imageDataUrls)],
    ["gateway", () => gatewayImageEdit(prompt, imageDataUrls)],
    ["nova-vision-2.1", () => novaVision21Edit(prompt, imageDataUrls[0])],
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

// ---------------- Nova Music 3.0 / 3.1 ----------------
function extractAudio(j: any): { buf: ArrayBuffer; mime: string } | null {
  // Predict-style response
  const pred = j?.predictions?.[0];
  const predB64 = pred?.audioContent ?? pred?.bytesBase64Encoded ?? pred?.audio;
  if (typeof predB64 === "string" && predB64.length > 100) {
    return { buf: b64ToBuffer(predB64), mime: pred?.mimeType ?? "audio/wav" };
  }
  // generateContent-style response
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p?.inlineData ?? p?.inline_data;
    if (inline?.data && String(inline.mimeType ?? inline.mime_type ?? "").startsWith("audio")) {
      return { buf: b64ToBuffer(inline.data), mime: inline.mimeType ?? inline.mime_type };
    }
  }
  return null;
}

async function novaMusic(prompt: string, tier: "short" | "song"): Promise<{ buf: ArrayBuffer; mime: string }> {
  const key = process.env.GeminimusicAPI || process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("nova-music: no key");
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
  throw lastErr ?? new Error("nova-music failed");
}

// ---------------- Admin / plan helpers ----------------
const DEV_EMAILS = (process.env.ADMIN_EMAILS ?? "paschalsoromtochukwu@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function isAdminUser(supabase: any, userId: string, email: string | null): Promise<boolean> {
  if (email && DEV_EMAILS.includes(email.toLowerCase())) return true;
  try {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    return !!data;
  } catch {
    return false;
  }
}

const FREE_IMAGE_DELAY_MS = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


// ---------- SERVER FUNCTIONS ----------

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    return { profile, usage };
  });

export const submitPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const profile = await loadProfile(supabase, userId);
    if (profile.promo_used) return { ok: false, plan: profile.plan, message: "Promo already used." };
    const serverCode = (process.env.PROMO_CODE ?? "").trim().toLowerCase();
    const isValid = !!serverCode && data.code.trim().toLowerCase() === serverCode;
    const plan: Plan = isValid ? "premium" : "free";
    const admin = await adminClient();
    await admin
      .from("profiles")
      .update({ plan, promo_used: true })
      .eq("id", userId);
    return { ok: true, plan, message: isValid ? "Promo accepted — Premium unlocked!" : "Invalid promo code — continuing as Free." };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[listThreads] DB error:", error);
      throw new Error("Failed to load threads. Please try again.");
    }
    return (data ?? []) as DBThread[];
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, thread_id, role, content, image_url, audio_url, watermarked, edited, created_at")
      .eq("user_id", userId)
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[getThreadMessages] DB error:", error);
      throw new Error("Failed to load messages. Please try again.");
    }
    // sign storage URLs
    const out: DBMessage[] = [];
    for (const m of msgs ?? []) {
      let img: string | null = m.image_url;
      if (img && !img.startsWith("http")) {
        const { data: signed } = await supabase.storage
          .from("generated-images")
          .createSignedUrl(img, 60 * 60 * 6);
        img = signed?.signedUrl ?? null;
      }
      let aud: string | null = m.audio_url ?? null;
      if (aud && !aud.startsWith("http")) {
        const { data: signedA } = await supabase.storage
          .from("generated-audio")
          .createSignedUrl(aud, 60 * 60 * 6);
        aud = signedA?.signedUrl ?? null;
      }
      out.push({ ...m, image_url: img, audio_url: aud });
    }
    return out;
  });

export const searchMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => z.object({ q: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const term = data.q.replace(/[%_,]/g, " ").trim();
    if (!term) return [];
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, thread_id, role, content, created_at")
      .eq("user_id", userId)
      .ilike("content", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      console.error("[searchMessages] DB error:", error);
      throw new Error("Search failed. Please try again.");
    }
    return (rows ?? []) as Array<{
      id: string;
      thread_id: string;
      role: string;
      content: string;
      created_at: string;
    }>;
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string; content: string }) =>
    z.object({ messageId: z.string().uuid(), content: z.string().min(1).max(12000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("messages")
      .update({ content: data.content, edited: true, edited_at: new Date().toISOString() })
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .eq("role", "user");
    if (error) {
      console.error("[editMessage] DB error:", error);
      throw new Error("Could not update the message. Please try again.");
    }
    return { ok: true };
  });

export const saveMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string; title?: string }) =>
    z.object({ messageId: z.string().uuid(), title: z.string().max(120).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: msg } = await supabase
      .from("messages")
      .select("id, audio_url, thread_id, created_at")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!msg?.audio_url) return { ok: false, message: "No track found on that message." };
    const { data: prompt } = await supabase
      .from("messages")
      .select("content")
      .eq("user_id", userId)
      .eq("thread_id", msg.thread_id)
      .eq("role", "user")
      .lt("created_at", msg.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("music_history").insert({
      user_id: userId,
      title: data.title ?? (prompt?.content ? deriveTitle(prompt.content) : "Untitled track"),
      prompt: prompt?.content ?? "",
      audio_path: msg.audio_url,
    });
    if (error) {
      console.error("[saveMusic] DB error:", error);
      return { ok: false, message: "Could not save this track." };
    }
    return { ok: true, message: "Saved to your music history." };
  });

export const listMusic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: rows } = await supabase
      .from("music_history")
      .select("id, title, prompt, audio_path, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    const out: Array<{ id: string; title: string; prompt: string; url: string | null; created_at: string }> = [];
    for (const r of rows ?? []) {
      const { data: signed } = await supabase.storage
        .from("generated-audio")
        .createSignedUrl(r.audio_path, 60 * 60 * 6);
      out.push({ id: r.id, title: r.title, prompt: r.prompt, url: signed?.signedUrl ?? null, created_at: r.created_at });
    }
    return out;
  });


export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: userId, title: "New chat" })
      .select("id, title, updated_at")
      .single();
    if (error) {
      console.error("[createThread] DB error:", error);
      throw new Error("Failed to create thread. Please try again.");
    }
    return data as DBThread;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await supabase.from("threads").delete().eq("user_id", userId).eq("id", data.threadId);
    return { ok: true };
  });

function deriveTitle(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 48 ? t.slice(0, 48) + "…" : t || "New chat";
}

// Short, human-readable chat title derived from the first exchange.
async function smartTitle(userText: string, assistantText: string): Promise<string> {
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

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; content: string; images?: string[] }) =>
    z
      .object({
        threadId: z.string().uuid(),
        content: z.string().min(1).max(12000),
        images: z
          .array(z.string().regex(/^data:image\/(jpeg|jpg|png|webp);base64,/i).max(8_000_000))
          .max(4)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // ensure thread belongs to user
    const { data: thread } = await supabase
      .from("threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("Thread not found");

    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    const isAdmin = await isAdminUser(supabase, userId, profile.email);
    const watermark = profile.plan !== "premium" && !isAdmin;

    const hasImages = !!data.images && data.images.length > 0;
    const wantsEdit = hasImages && detectImageEdit(data.content);
    const music = hasImages ? null : detectMusicRequest(data.content);
    const imagePrompt = hasImages || music ? null : detectImageRequest(data.content);
    const isImage = !!imagePrompt || wantsEdit;
    const isMedia = isImage || !!music;

    if (isMedia && !isAdmin && usage.image_count >= usage.image_limit) {
      return {
        ok: false,
        kind: "limit" as const,
        message: music ? "Music limit reached. Resets every 5 hours." : "Image limit reached. Resets every 5 hours.",
      };
    }
    if (!isMedia && !isAdmin && usage.text_count >= usage.text_limit) {
      return { ok: false, kind: "limit" as const, message: "Text limit reached. Will reset automatically." };
    }

    // Insert user message
    await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.content,
    });
    await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);

    let assistantContent = "";
    let imagePath: string | null = null;
    let signedImage: string | null = null;
    let audioPath: string | null = null;
    let signedAudio: string | null = null;
    let watermarked = false;

    async function storeImage(buf: ArrayBuffer) {
      const path = `${userId}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from("generated-images")
        .upload(path, new Uint8Array(buf), { contentType: "image/png" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("generated-images")
        .createSignedUrl(path, 60 * 60 * 6);
      imagePath = path;
      signedImage = signed?.signedUrl ?? null;
      watermarked = watermark;
    }

    async function bumpImage() {
      const adm = await adminClient();
      await adm.from("usage").update({ image_count: usage.image_count + 1 }).eq("user_id", userId);
    }
    async function bumpText() {
      const adm = await adminClient();
      await adm.from("usage").update({ text_count: usage.text_count + 1 }).eq("user_id", userId);
    }

    if (music) {
      try {
        if (!isAdmin) await sleep(FREE_IMAGE_DELAY_MS);
        const { buf, mime } = await novaMusic(music.prompt, music.tier);
        const ext = mime.includes("mpeg") ? "mp3" : mime.includes("ogg") ? "ogg" : "wav";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("generated-audio")
          .upload(path, new Uint8Array(buf), { contentType: mime || "audio/wav" });
        if (upErr) throw upErr;
        audioPath = path;
        const { data: signed } = await supabase.storage
          .from("generated-audio")
          .createSignedUrl(path, 60 * 60 * 6);
        signedAudio = signed?.signedUrl ?? null;
        assistantContent = music.tier === "song" ? "Here's your song:" : "Here's your track:";
        if (!isAdmin) await bumpImage();
      } catch (e) {
        console.error("music gen failed:", e);
        assistantContent = "Sorry, music generation is unavailable right now. Please try again later.";
      }
    } else if (wantsEdit) {
      try {
        if (!isAdmin) await sleep(FREE_IMAGE_DELAY_MS);
        await storeImage(await editImage(data.content, data.images!));
        assistantContent = "Here's your edited image:";
        if (!isAdmin) await bumpImage();
      } catch (e) {
        console.error("image edit failed:", e);
        assistantContent = "Sorry, image editing is unavailable right now. Please try again later.";
      }
    } else if (imagePrompt) {
      try {
        if (!isAdmin) await sleep(FREE_IMAGE_DELAY_MS);
        await storeImage(await generateImage(imagePrompt));
        assistantContent = "Here's your image:";
        if (!isAdmin) await bumpImage();
      } catch (e) {
        console.error("image gen failed:", e);
        assistantContent = "Sorry, image generation is unavailable right now. Please try again later.";
      }
    } else if (hasImages) {
      try {
        assistantContent = await novaVisionAnalyze(data.content, data.images!);
        if (!isAdmin) await bumpText();
      } catch (e) {
        console.error("vision failed:", e);
        assistantContent = "Sorry, I couldn't analyze the image right now. Please try again.";
      }
    } else {
      const { data: history } = await supabase
        .from("messages")
        .select("role, content")
        .eq("user_id", userId)
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: true })
        .limit(40);
      try {
        assistantContent = await generateText(
          (history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
        );
        if (!isAdmin) await bumpText();
      } catch (e) {
        console.error("text gen failed:", e);
        assistantContent = "AI is currently unavailable. Please try again.";
      }
    }

    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        thread_id: data.threadId,
        user_id: userId,
        role: "assistant",
        content: assistantContent,
        image_url: imagePath,
        audio_url: audioPath,
        watermarked,
      })
      .select("id, thread_id, role, content, image_url, audio_url, watermarked, edited, created_at")
      .single();

    // Smart title once the first exchange completes.
    let newTitle: string | null = null;
    if (thread.title === "New chat") {
      newTitle = await smartTitle(data.content, assistantContent);
      await supabase.from("threads").update({ title: newTitle }).eq("id", data.threadId);
    }

    return {
      ok: true,
      kind: "message" as const,
      title: newTitle,
      assistant: {
        ...(inserted as any),
        image_url: signedImage ?? (inserted as any)?.image_url ?? null,
        audio_url: signedAudio ?? (inserted as any)?.audio_url ?? null,
      },
    };
  });


export const regenerateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) =>
    z.object({ messageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    // Find the assistant message and the prior user message (the prompt)
    const { data: asst } = await supabase
      .from("messages")
      .select("id, thread_id, created_at, image_url")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!asst) throw new Error("Message not found");
    const { data: prev } = await supabase
      .from("messages")
      .select("content")
      .eq("user_id", userId)
      .eq("thread_id", asst.thread_id)
      .eq("role", "user")
      .lt("created_at", asst.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prev) throw new Error("No prompt found");

    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    if (usage.image_count >= usage.image_limit) {
      return { ok: false, kind: "limit" as const, message: "Image limit reached." };
    }

    try {
      const buf = await generateImage(prev.content);
      const path = `${userId}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from("generated-images")
        .upload(path, new Uint8Array(buf), { contentType: "image/png" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("generated-images")
        .createSignedUrl(path, 60 * 60 * 6);
      await supabase
        .from("messages")
        .update({ image_url: path, content: "Here's your image:" })
        .eq("id", data.messageId);
      const _admin4 = await adminClient();
      await _admin4
        .from("usage")
        .update({ image_count: usage.image_count + 1 })
        .eq("user_id", userId);
      return { ok: true, kind: "message" as const, image_url: signed?.signedUrl ?? null };
    } catch (e) {
      console.error("regen failed:", e);
      return { ok: false, kind: "error" as const, message: "Image generation failed. Please try again later." };
    }
  });

export const regenerateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) =>
    z.object({ messageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: asst } = await supabase
      .from("messages")
      .select("id, thread_id, created_at, image_url")
      .eq("id", data.messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!asst) throw new Error("Message not found");
    if (asst.image_url) return { ok: false, kind: "error" as const, message: "Use image regenerate instead." };

    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    if (usage.text_count >= usage.text_limit) {
      return { ok: false, kind: "limit" as const, message: "Text limit reached." };
    }
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .eq("thread_id", asst.thread_id)
      .lt("created_at", asst.created_at)
      .order("created_at", { ascending: true })
      .limit(40);
    try {
      const text = await generateText(
        (history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
      );
      await supabase.from("messages").update({ content: text }).eq("id", data.messageId);
      const _admin5 = await adminClient();
      await _admin5.from("usage").update({ text_count: usage.text_count + 1 }).eq("user_id", userId);
      return { ok: true, kind: "message" as const, content: text };
    } catch (e) {
      console.error("regen text failed:", e);
      return { ok: false, kind: "error" as const, message: "Regeneration failed. Please try again." };
    }
  });

