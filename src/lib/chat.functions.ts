import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITS, PROMO_CODE, TEXT_RESET_MS, IMAGE_RESET_MS, type Plan } from "./limits";
import { detectImageRequest } from "./intent";

// ---------- types ----------
export type DBMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
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
  // backfill (e.g. for users created before trigger)
  await supabase.from("profiles").insert({ id: userId }).select();
  return { plan: "free", promo_used: false, email: null };
}

async function loadOrResetUsage(supabase: any, userId: string, plan: Plan): Promise<UsageData> {
  const lim = LIMITS[plan];
  const { data } = await supabase
    .from("usage")
    .select("text_count, image_count, text_window_start, image_window_start")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    await supabase.from("usage").insert({ user_id: userId });
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
    await supabase.from("usage").update(updates).eq("user_id", userId);
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

// ---------- AI providers (text) ----------
type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
const SYSTEM_PROMPT = `You are NovaMind AI, a helpful, friendly, capable assistant. Excellent at conversation, coding, debugging, tutoring, and problem solving. Format code in fenced markdown blocks with language tags. Be concise but thorough.`;

async function callGroq(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error("no groq key");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
    }),
  });
  if (!r.ok) throw new Error("groq " + r.status);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("groq empty");
  return txt;
}

async function callGemini(messages: ChatMsg[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      }),
    },
  );
  if (!r.ok) throw new Error("gemini " + r.status);
  const j = await r.json();
  const txt = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("");
  if (!txt) throw new Error("gemini empty");
  return txt;
}

async function callHuggingFaceText(messages: ChatMsg[]): Promise<string> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("no hf key");
  const r = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.1-8B-Instruct:novita",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    },
  );
  if (!r.ok) throw new Error("hf " + r.status);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content;
  if (!txt) throw new Error("hf empty");
  return txt;
}

async function generateText(messages: ChatMsg[]): Promise<string> {
  const providers = [callGroq, callGemini, callHuggingFaceText];
  let lastErr: any = null;
  for (const p of providers) {
    try {
      return await p(messages);
    } catch (e) {
      lastErr = e;
      console.error("text provider failed:", (e as Error).message);
    }
  }
  throw lastErr ?? new Error("all text providers failed");
}

// ---------- AI providers (image) ----------
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
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`stability ${r.status} ${txt.slice(0, 200)}`);
  }
  return r.arrayBuffer();
}

async function callHuggingFaceImage(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) throw new Error("no hf key");
  // Try a couple of well-known SDXL endpoints; HF inference availability fluctuates.
  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "black-forest-labs/FLUX.1-schnell",
  ];
  let lastErr: any = null;
  for (const m of models) {
    try {
      const r = await fetch(`https://api-inference.huggingface.co/models/${m}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "image/png" },
        body: JSON.stringify({ inputs: prompt }),
      });
      if (!r.ok) {
        lastErr = new Error(`hf ${m} ${r.status}`);
        continue;
      }
      return await r.arrayBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("hf image failed");
}

async function callLovableImage(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("no lovable key");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      prompt,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!r.ok) throw new Error("lovable img " + r.status);
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("lovable img empty");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function callOpenAIImage(prompt: string): Promise<ArrayBuffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no openai key");
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`openai img ${r.status} ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("openai img empty");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const providers: Array<{ name: string; fn: (p: string) => Promise<ArrayBuffer> }> = [
    { name: "stability", fn: callStability },
    { name: "huggingface", fn: callHuggingFaceImage },
    { name: "lovable", fn: callLovableImage },
    { name: "openai", fn: callOpenAIImage },
  ];
  let lastErr: any = null;
  for (const p of providers) {
    try {
      const buf = await p.fn(prompt);
      console.log(`image provider ok: ${p.name}`);
      return buf;
    } catch (e) {
      lastErr = e;
      console.error(`image provider ${p.name} failed:`, (e as Error).message);
    }
  }
  throw lastErr ?? new Error("all image providers failed");
}

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
    const isValid = data.code.trim().toLowerCase() === PROMO_CODE.toLowerCase();
    const plan: Plan = isValid ? "premium" : "free";
    await supabase
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
    if (error) throw new Error(error.message);
    return (data ?? []) as DBThread[];
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, thread_id, role, content, image_url, created_at")
      .eq("user_id", userId)
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // sign image URLs
    const out: DBMessage[] = [];
    for (const m of msgs ?? []) {
      let img: string | null = m.image_url;
      if (img && !img.startsWith("http")) {
        const { data: signed } = await supabase.storage
          .from("generated-images")
          .createSignedUrl(img, 60 * 60 * 6);
        img = signed?.signedUrl ?? null;
      }
      out.push({ ...m, image_url: img });
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
    if (error) throw new Error(error.message);
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

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; content: string }) =>
    z.object({ threadId: z.string().uuid(), content: z.string().min(1).max(8000) }).parse(d),
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

    const imagePrompt = detectImageRequest(data.content);
    const isImage = !!imagePrompt;

    if (isImage && usage.image_count >= usage.image_limit) {
      return { ok: false, kind: "limit" as const, message: "Image limit reached. Resets every 5 hours." };
    }
    if (!isImage && usage.text_count >= usage.text_limit) {
      return { ok: false, kind: "limit" as const, message: "Text limit reached. Will reset automatically." };
    }

    // Insert user message
    await supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      content: data.content,
    });

    // Update title if it was the default
    if (thread.title === "New chat") {
      await supabase
        .from("threads")
        .update({ title: deriveTitle(data.content), updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    } else {
      await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);
    }

    let assistantContent = "";
    let imagePath: string | null = null;
    let signedImage: string | null = null;

    if (isImage) {
      try {
        const buf = await generateImage(imagePrompt!);
        const path = `${userId}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await supabase.storage
          .from("generated-images")
          .upload(path, new Uint8Array(buf), { contentType: "image/png" });
        if (upErr) throw upErr;
        imagePath = path;
        const { data: signed } = await supabase.storage
          .from("generated-images")
          .createSignedUrl(path, 60 * 60 * 6);
        signedImage = signed?.signedUrl ?? null;
        assistantContent = `Here's your image:`;
        await supabase
          .from("usage")
          .update({ image_count: usage.image_count + 1 })
          .eq("user_id", userId);
      } catch (e) {
        console.error("image gen failed:", e);
        assistantContent = "Sorry, image generation is unavailable right now. Please try again later.";
      }
    } else {
      // Build history (re-load last N messages for context)
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
        await supabase
          .from("usage")
          .update({ text_count: usage.text_count + 1 })
          .eq("user_id", userId);
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
      })
      .select("id, thread_id, role, content, image_url, created_at")
      .single();

    return {
      ok: true,
      kind: "message" as const,
      assistant: { ...(inserted as any), image_url: signedImage ?? (inserted as any).image_url },
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
      await supabase
        .from("usage")
        .update({ image_count: usage.image_count + 1 })
        .eq("user_id", userId);
      return { ok: true, kind: "message" as const, image_url: signed?.signedUrl ?? null };
    } catch (e) {
      console.error("regen failed:", e);
      return { ok: false, kind: "error" as const, message: "Image generation failed. Please try again later." };
    }
  });
