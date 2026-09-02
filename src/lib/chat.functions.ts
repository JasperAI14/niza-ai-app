import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Plan } from "./limits";
import {
  adminClient,
  deriveTitle,
  editImage,
  FREE_CLEAN_IMAGES,
  generateImage,
  generateText,
  isAdminUser,
  loadOrResetUsage,
  loadProfile,
  mediaDelay,
  nizaMusic,
  nizaVisionAnalyze,
  routeRequest,
  smartTitle,
  webSearchAnswer,
} from "./chat.server";

// ---------- types (erased at build time) ----------
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

export type DBThread = { id: string; title: string; updated_at: string; pinned?: boolean };

export type ProfileData = { plan: Plan; promo_used: boolean; email: string | null };

export type UsageData = {
  text_count: number;
  image_count: number;
  text_window_start: string;
  image_window_start: string;
  text_limit: number;
  image_limit: number;
};

// ---------- SERVER FUNCTIONS ----------

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    const isAdmin = await isAdminUser(supabase, userId, profile.email);
    const cleanImagesLeft =
      profile.plan === "premium" || isAdmin
        ? null
        : Math.max(0, FREE_CLEAN_IMAGES - usage.image_count);
    return { profile, usage, isAdmin, cleanImagesLeft };
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
    await admin.from("profiles").update({ plan, promo_used: true }).eq("id", userId);
    return {
      ok: true,
      plan,
      message: isValid ? "Promo accepted — Premium unlocked!" : "Invalid promo code — continuing as Free.",
    };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, updated_at, pinned")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[listThreads] DB error:", error);
      throw new Error("Failed to load chats. Please try again.");
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
    if (!term) return { threads: [], messages: [] };
    const [{ data: threads }, { data: rows, error }] = await Promise.all([
      supabase
        .from("threads")
        .select("id, title, updated_at, pinned")
        .eq("user_id", userId)
        .ilike("title", `%${term}%`)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("messages")
        .select("id, thread_id, role, content, created_at")
        .eq("user_id", userId)
        .ilike("content", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    if (error) {
      console.error("[searchMessages] DB error:", error);
      throw new Error("Search failed. Please try again.");
    }
    return {
      threads: (threads ?? []) as DBThread[],
      messages: (rows ?? []) as Array<{
        id: string;
        thread_id: string;
        role: string;
        content: string;
        created_at: string;
      }>,
    };
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

export const setFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string; rating: number }) =>
    z.object({ messageId: z.string().uuid(), rating: z.number().int().min(-1).max(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (data.rating === 0) {
      await supabase.from("message_feedback").delete().eq("user_id", userId).eq("message_id", data.messageId);
      return { ok: true, rating: 0 };
    }
    await supabase.from("message_feedback").delete().eq("user_id", userId).eq("message_id", data.messageId);
    const { error } = await supabase
      .from("message_feedback")
      .insert({ user_id: userId, message_id: data.messageId, rating: data.rating });
    if (error) {
      console.error("[setFeedback] DB error:", error);
      throw new Error("Could not save your feedback.");
    }
    return { ok: true, rating: data.rating };
  });

export const listFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: msgs } = await supabase
      .from("messages")
      .select("id")
      .eq("user_id", userId)
      .eq("thread_id", data.threadId);
    const ids = (msgs ?? []).map((m: any) => m.id);
    if (!ids.length) return {} as Record<string, number>;
    const { data: rows } = await supabase
      .from("message_feedback")
      .select("message_id, rating")
      .eq("user_id", userId)
      .in("message_id", ids);
    const out: Record<string, number> = {};
    for (const r of rows ?? []) out[r.message_id] = r.rating;
    return out;
  });

export const togglePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string; threadId: string }) =>
    z.object({ messageId: z.string().uuid(), threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: existing } = await supabase
      .from("pinned_messages")
      .select("id")
      .eq("user_id", userId)
      .eq("message_id", data.messageId)
      .maybeSingle();
    if (existing) {
      await supabase.from("pinned_messages").delete().eq("id", existing.id);
      return { ok: true, pinned: false };
    }
    const { error } = await supabase
      .from("pinned_messages")
      .insert({ user_id: userId, message_id: data.messageId, thread_id: data.threadId });
    if (error) {
      console.error("[togglePin] DB error:", error);
      throw new Error("Could not pin this message.");
    }
    return { ok: true, pinned: true };
  });

export const listPinned = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: rows } = await supabase
      .from("pinned_messages")
      .select("message_id")
      .eq("user_id", userId)
      .eq("thread_id", data.threadId);
    return (rows ?? []).map((r: any) => r.message_id as string);
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
      out.push({
        id: r.id,
        title: r.title,
        prompt: r.prompt,
        url: signed?.signedUrl ?? null,
        created_at: r.created_at,
      });
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
      .select("id, title, updated_at, pinned")
      .single();
    if (error) {
      console.error("[createThread] DB error:", error);
      throw new Error("Failed to create chat. Please try again.");
    }
    return data as DBThread;
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; title: string }) =>
    z.object({ threadId: z.string().uuid(), title: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const title = data.title.trim().replace(/\s+/g, " ");
    const { error } = await supabase
      .from("threads")
      .update({ title })
      .eq("user_id", userId)
      .eq("id", data.threadId);
    if (error) {
      console.error("[renameThread] DB error:", error);
      throw new Error("Could not rename this chat.");
    }
    return { ok: true, title };
  });

export const setThreadPinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; pinned: boolean }) =>
    z.object({ threadId: z.string().uuid(), pinned: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("threads")
      .update({ pinned: data.pinned })
      .eq("user_id", userId)
      .eq("id", data.threadId);
    if (error) {
      console.error("[setThreadPinned] DB error:", error);
      throw new Error("Could not update this chat.");
    }
    return { ok: true, pinned: data.pinned };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await supabase.from("threads").delete().eq("user_id", userId).eq("id", data.threadId);
    return { ok: true };
  });

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

    const { data: thread } = await supabase
      .from("threads")
      .select("id, title")
      .eq("id", data.threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!thread) throw new Error("Chat not found");

    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    const isAdmin = await isAdminUser(supabase, userId, profile.email);

    const hasImages = !!data.images && data.images.length > 0;
    const route = await routeRequest(data.content, hasImages);
    const isImage = route.mode === "IMAGE_GEN" || route.mode === "IMAGE_EDIT";
    const isMusic = route.mode === "MUSIC_SHORT" || route.mode === "MUSIC_SONG";
    const isMedia = isImage || isMusic;

    if (isMedia && !isAdmin && usage.image_count >= usage.image_limit) {
      return {
        ok: false,
        kind: "limit" as const,
        message: isMusic
          ? "Music limit reached. It resets every 5 hours."
          : "Image limit reached. It resets every 5 hours.",
      };
    }
    if (!isMedia && !isAdmin && usage.text_count >= usage.text_limit) {
      return { ok: false, kind: "limit" as const, message: "Text limit reached. It will reset automatically." };
    }

    // Free accounts get their first few images clean, then watermarked.
    const watermark =
      profile.plan !== "premium" && !isAdmin && usage.image_count >= FREE_CLEAN_IMAGES;

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

    if (isMusic) {
      try {
        await mediaDelay(isAdmin);
        const tier = route.mode === "MUSIC_SONG" ? "song" : "short";
        const { buf, mime } = await nizaMusic(route.prompt, tier);
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
        assistantContent = tier === "song" ? "Here's your song:" : "Here's your track:";
        if (!isAdmin) await bumpImage();
      } catch (e) {
        console.error("music gen failed:", e);
        assistantContent = "Sorry, music generation is unavailable right now. Please try again later.";
      }
    } else if (route.mode === "IMAGE_EDIT") {
      try {
        await mediaDelay(isAdmin);
        await storeImage(await editImage(data.content, data.images!));
        assistantContent = "Here's your edited image:";
        if (!isAdmin) await bumpImage();
      } catch (e) {
        console.error("image edit failed:", e);
        assistantContent = "Sorry, image editing is unavailable right now. Please try again later.";
      }
    } else if (route.mode === "IMAGE_GEN") {
      try {
        await mediaDelay(isAdmin);
        await storeImage(await generateImage(route.prompt));
        assistantContent = "Here's your image:";
        if (!isAdmin) await bumpImage();
      } catch (e) {
        console.error("image gen failed:", e);
        assistantContent = "Sorry, image generation is unavailable right now. Please try again later.";
      }
    } else if (route.mode === "VISION") {
      try {
        assistantContent = await nizaVisionAnalyze(data.content, data.images!);
        if (!isAdmin) await bumpText();
      } catch (e) {
        console.error("vision failed:", e);
        assistantContent = "Sorry, I couldn't analyse that image right now. Please try again.";
      }
    } else if (route.mode === "CLARIFY") {
      // A clarification turn never consumes quota.
      const c = route.clarification;
      assistantContent = c
        ? [c.question, ...(c.options.length ? [c.options.map((o) => `- ${o}`).join("\n")] : [])].join("\n\n")
        : "Could you tell me a bit more about what you need?";
    } else if (route.mode === "WEB_SEARCH") {
      try {
        const { text, sources } = await webSearchAnswer(route.prompt);
        assistantContent = sources.length
          ? `${text}\n\n**Sources**\n${sources.map((s) => `- [${s.title}](${s.url})`).join("\n")}`
          : text;
        if (!isAdmin) await bumpText();
      } catch (e) {
        console.error("web search failed:", e);
        assistantContent = "I couldn't check live sources just now. Please try again shortly.";
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
        assistantContent = "Niza Prime AI is currently unavailable. Please try again.";
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
        media_prompt: isMedia ? route.prompt : null,
      })
      .select("id, thread_id, role, content, image_url, audio_url, watermarked, edited, created_at")
      .single();

    let newTitle: string | null = null;
    if (thread.title === "New chat") {
      newTitle = await smartTitle(data.content, assistantContent);
      await supabase.from("threads").update({ title: newTitle }).eq("id", data.threadId);
    }

    return {
      ok: true,
      kind: "message" as const,
      title: newTitle,
      mode: route.mode,
      assistant: {
        ...(inserted as any),
        image_url: signedImage ?? (inserted as any)?.image_url ?? null,
        audio_url: signedAudio ?? (inserted as any)?.audio_url ?? null,
      },
    };
  });

export const regenerateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: asst } = await supabase
      .from("messages")
      .select("id, thread_id, created_at, image_url, media_prompt")
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
    const prompt = asst.media_prompt || prev?.content;
    if (!prompt) throw new Error("No prompt found");

    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    const isAdmin = await isAdminUser(supabase, userId, profile.email);
    if (!isAdmin && usage.image_count >= usage.image_limit) {
      return { ok: false, kind: "limit" as const, message: "Image limit reached." };
    }
    const watermark = profile.plan !== "premium" && !isAdmin && usage.image_count >= FREE_CLEAN_IMAGES;

    try {
      const buf = await generateImage(prompt);
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
        .update({ image_url: path, content: "Here's your image:", watermarked: watermark })
        .eq("id", data.messageId);
      if (!isAdmin) {
        const adm = await adminClient();
        await adm.from("usage").update({ image_count: usage.image_count + 1 }).eq("user_id", userId);
      }
      return {
        ok: true,
        kind: "message" as const,
        image_url: signed?.signedUrl ?? null,
        watermarked: watermark,
      };
    } catch (e) {
      console.error("regen failed:", e);
      return { ok: false, kind: "error" as const, message: "Image generation failed. Please try again later." };
    }
  });

export const regenerateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) => z.object({ messageId: z.string().uuid() }).parse(d))
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
    const isAdmin = await isAdminUser(supabase, userId, profile.email);
    if (!isAdmin && usage.text_count >= usage.text_limit) {
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
      if (!isAdmin) {
        const adm = await adminClient();
        await adm.from("usage").update({ text_count: usage.text_count + 1 }).eq("user_id", userId);
      }
      return { ok: true, kind: "message" as const, content: text };
    } catch (e) {
      console.error("regen text failed:", e);
      return { ok: false, kind: "error" as const, message: "Regeneration failed. Please try again." };
    }
  });

export const generateMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string; tier?: "short" | "song" }) =>
    z.object({ prompt: z.string().min(2).max(2000), tier: z.enum(["short", "song"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const profile = await loadProfile(supabase, userId);
    const usage = await loadOrResetUsage(supabase, userId, profile.plan);
    const isAdmin = await isAdminUser(supabase, userId, profile.email);
    if (!isAdmin && usage.image_count >= usage.image_limit) {
      return { ok: false, kind: "limit" as const, message: "Music limit reached. It resets every 5 hours." };
    }
    const route = await routeRequest(data.prompt, false);
    const tier: "short" | "song" =
      data.tier ?? (route.mode === "MUSIC_SONG" ? "song" : "short");
    try {
      await mediaDelay(isAdmin);
      const { buf, mime } = await nizaMusic(data.prompt, tier);
      const ext = mime.includes("mpeg") ? "mp3" : mime.includes("ogg") ? "ogg" : "wav";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("generated-audio")
        .upload(path, new Uint8Array(buf), { contentType: mime || "audio/wav" });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("generated-audio")
        .createSignedUrl(path, 60 * 60 * 6);
      const title = deriveTitle(data.prompt);
      const { data: row } = await supabase
        .from("music_history")
        .insert({ user_id: userId, title, prompt: data.prompt, audio_path: path })
        .select("id, created_at")
        .single();
      if (!isAdmin) {
        const adm = await adminClient();
        await adm.from("usage").update({ image_count: usage.image_count + 1 }).eq("user_id", userId);
      }
      return {
        ok: true,
        kind: "track" as const,
        track: {
          id: row?.id ?? crypto.randomUUID(),
          title,
          prompt: data.prompt,
          url: signed?.signedUrl ?? null,
          created_at: row?.created_at ?? new Date().toISOString(),
        },
      };
    } catch (e) {
      console.error("music gen failed:", e);
      return { ok: false, kind: "error" as const, message: "Music generation is unavailable right now." };
    }
  });

export const deleteMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await supabase.from("music_history").delete().eq("user_id", userId).eq("id", data.id);
    return { ok: true };
  });
