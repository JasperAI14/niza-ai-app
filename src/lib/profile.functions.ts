import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProfileFull = {
  id: string;
  email: string | null;
  plan: string;
  plan_status: string;
  display_name: string | null;
  username: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  isAdmin: boolean;
};

const DEV_EMAILS = (process.env.ADMIN_EMAILS ?? "paschalsoromtochukwu@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isAdminUser(supabase: any, userId: string, email: string | null) {
  if (email && DEV_EMAILS.includes(email.toLowerCase())) return true;
  try {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    return !!data;
  } catch {
    return false;
  }
}

async function requireAdmin(context: any) {
  const { supabase, userId } = context;
  const { data: p } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  const ok = await isAdminUser(supabase, userId, p?.email ?? null);
  if (!ok) throw new Error("not_allowed");
  return { supabase, userId };
}

async function signAvatar(db: any, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

function fallbackName(email: string | null) {
  if (!email) return "NovaMind user";
  return email.split("@")[0];
}

// ---------------- Profile ----------------

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileFull> => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("profiles")
      .select("id,email,plan,plan_status,display_name,username,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const db = await admin();
    const isAdmin = await isAdminUser(supabase, userId, data?.email ?? null);
    return {
      id: userId,
      email: data?.email ?? null,
      plan: data?.plan ?? "free",
      plan_status: data?.plan_status ?? "inactive",
      display_name: data?.display_name ?? fallbackName(data?.email ?? null),
      username: data?.username ?? null,
      avatar_path: data?.avatar_url ?? null,
      avatar_url: await signAvatar(db, data?.avatar_url ?? null),
      isAdmin,
    };
  });

const usernameRe = /^[a-z0-9_.]{3,20}$/;

export const checkUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string }) => z.object({ username: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const u = data.username.trim().toLowerCase();
    if (!usernameRe.test(u)) {
      return { ok: false, message: "Usernames use 3–20 lowercase letters, numbers, dots or underscores." };
    }
    const db = await admin();
    const { data: rows } = await db.from("profiles").select("id").ilike("username", u).limit(1);
    if (rows?.length && rows[0].id !== userId) {
      return { ok: false, message: "That username is already taken. Please try another one." };
    }
    return { ok: true, message: "That username is available." };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name?: string; username?: string; avatar_path?: string }) =>
    z
      .object({
        display_name: z.string().max(60).optional(),
        username: z.string().max(40).optional(),
        avatar_path: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const patch: Record<string, unknown> = {};

    if (data.display_name !== undefined) {
      const name = data.display_name.trim();
      if (name.length < 2 || name.length > 40) {
        return { ok: false, message: "Your display name should be between 2 and 40 characters." };
      }
      if (!/^[\p{L}\p{N} '._-]+$/u.test(name)) {
        return { ok: false, message: "Please use letters, numbers, spaces, apostrophes, dots or dashes." };
      }
      patch.display_name = name;
    }

    if (data.username !== undefined) {
      const u = data.username.trim().toLowerCase();
      if (!usernameRe.test(u)) {
        return { ok: false, message: "Usernames use 3–20 lowercase letters, numbers, dots or underscores." };
      }
      patch.username = u;
    }

    if (data.avatar_path !== undefined) {
      if (!data.avatar_path.startsWith(`${userId}/`)) {
        return { ok: false, message: "We couldn't use that picture. Please try again." };
      }
      patch.avatar_url = data.avatar_path;
    }

    if (!Object.keys(patch).length) return { ok: true, message: "Nothing to update." };

    const db = await admin();
    const { error } = await db.from("profiles").update(patch as any).eq("id", userId);
    if (error) {
      if ((error as any).code === "23505") {
        return { ok: false, message: "That username is already taken. Please try another one." };
      }
      return { ok: false, message: "We couldn't save your changes right now. Please try again." };
    }
    return { ok: true, message: "Your changes have been saved successfully." };
  });

// ---------------- Support ----------------

export const submitSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      subject: string;
      message: string;
      screenshot_path?: string | null;
      thread_id?: string | null;
      diagnostics?: Record<string, unknown>;
    }) =>
      z
        .object({
          subject: z.string().min(3).max(140),
          message: z.string().min(10).max(6000),
          screenshot_path: z.string().max(300).nullable().optional(),
          thread_id: z.string().uuid().nullable().optional(),
          diagnostics: z.record(z.string(), z.any()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const db = await admin();
    const { error } = await db.from("support_requests").insert({
      user_id: userId,
      subject: data.subject.trim(),
      message: data.message.trim(),
      screenshot_url: data.screenshot_path ?? null,
      thread_id: data.thread_id ?? null,
      diagnostics: data.diagnostics ?? {},
    });
    if (error) return { ok: false, message: "We couldn't send your message right now. Please try again." };
    await notifyAdmins(db, "New support request", data.subject.trim());
    return {
      ok: true,
      message: "Our Support Team has received your request and will review it as soon as possible.",
    };
  });

// ---------------- Reviews ----------------

const ESCALATE_RE =
  /\b(bug|crash|error|broken|not working|doesn'?t work|refund|charge|charged|payment|paid|billing|subscription|login|log in|sign in|sign-?in|password|account|hacked|security|privacy breach|lost|missing|deleted|data)\b/i;

async function aiReply(review: { rating: number; body: string; escalated: boolean }): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  const guidance = review.escalated
    ? `Write a short reply confirming the feedback has been passed to the Support Team for careful review, and that they will respond as soon as possible.`
    : `Write a short, warm thank-you reply that references what the user said.`;
  const prompt = `You are a professional customer support representative for NovaMind AI. ${guidance}
Rules: 2 sentences maximum. Warm, human and professional. Never use the words recorded, logged or stored. Never mention administrators, developers, models or providers — only "our Support Team" or "we". Do not repeat generic filler.

Rating: ${review.rating}/5
Review: ${review.body}`;
  try {
    if (!key) throw new Error("no key");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j: any = await r.json();
    const text = j?.choices?.[0]?.message?.content?.trim();
    if (text) return text;
    throw new Error("empty");
  } catch {
    return review.escalated
      ? "Thank you for bringing this to our attention. Your feedback has been forwarded to our Support Team for further review, and we'll respond as soon as possible."
      : "Thank you for taking the time to share your feedback. We truly appreciate your support, and your comments help us continue improving NovaMind AI.";
  }
}

async function notifyAdmins(db: any, title: string, body: string) {
  try {
    const { data } = await db.from("user_roles").select("user_id").eq("role", "admin");
    const ids: string[] = (data ?? []).map((r: any) => r.user_id);
    for (const email of DEV_EMAILS) {
      const { data: p } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
      if (p?.id && !ids.includes(p.id)) ids.push(p.id);
    }
    if (!ids.length) return;
    await db
      .from("notifications")
      .insert(ids.map((id) => ({ user_id: id, title, body, kind: "admin", audience: "admin" })));
  } catch {
    // notifications are best-effort
  }
}

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rating: number; body: string; screenshot_path?: string | null }) =>
    z
      .object({
        rating: z.number().int().min(1).max(5),
        body: z.string().min(5).max(4000),
        screenshot_path: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const db = await admin();
    const escalated = ESCALATE_RE.test(data.body) || data.rating <= 2;
    const reply = await aiReply({ rating: data.rating, body: data.body, escalated });

    const { data: inserted, error } = await db
      .from("reviews")
      .insert({
        user_id: userId,
        rating: data.rating,
        body: data.body.trim(),
        screenshot_url: data.screenshot_path ?? null,
        ai_reply: reply,
        escalated,
        status: escalated ? "escalated" : "answered",
      })
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: "We couldn't send your feedback right now. Please try again." };

    if (escalated) {
      await db.from("support_requests").insert({
        user_id: userId,
        subject: `Feedback needing attention (${data.rating}/5)`,
        message: data.body.trim(),
        screenshot_url: data.screenshot_path ?? null,
        source: "review",
        diagnostics: { review_id: inserted?.id ?? null },
      });
      await notifyAdmins(db, "Review escalated to Support", data.body.trim().slice(0, 140));
    } else {
      await notifyAdmins(db, "New review received", `${data.rating}/5 — ${data.body.trim().slice(0, 120)}`);
    }

    await db.from("notifications").insert({
      user_id: userId,
      title: "Thanks for your feedback",
      body: reply,
      kind: "support",
    });

    return { ok: true, message: "Thank you for your feedback.", reply };
  });

export const listMyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("reviews")
      .select("id,rating,body,ai_reply,admin_reply,status,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

// ---------------- Notifications ----------------

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,kind,audience,read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await supabase.from("notifications").update({ read: true }).eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });

// ---------------- Error reporting ----------------

export const reportError = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { message: string; feature?: string; error_type?: string; details?: Record<string, unknown> }) =>
      z
        .object({
          message: z.string().max(4000),
          feature: z.string().max(80).optional(),
          error_type: z.string().max(80).optional(),
          details: z.record(z.string(), z.any()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("error_reports").insert({
      message: data.message,
      feature: data.feature ?? null,
      error_type: data.error_type ?? "error",
      details: data.details ?? {},
      app_version: (data.details as any)?.appVersion ?? null,
      device: (data.details as any)?.device ?? null,
    });
    return { ok: true };
  });

// ---------------- Admin dashboards ----------------

export const adminListReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = await admin();
    const { data: reviews } = await db
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = [...new Set((reviews ?? []).map((r: any) => r.user_id))];
    const { data: people } = ids.length
      ? await db.from("profiles").select("id,email,display_name,username,avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId = Object.fromEntries((people ?? []).map((p: any) => [p.id, p]));
    const total = reviews?.length ?? 0;
    const avg = total ? (reviews ?? []).reduce((s: number, r: any) => s + r.rating, 0) / total : 0;
    const distribution = [1, 2, 3, 4, 5].map(
      (n) => (reviews ?? []).filter((r: any) => r.rating === n).length,
    );
    return {
      stats: {
        total,
        average: Math.round(avg * 10) / 10,
        distribution,
        answered: (reviews ?? []).filter((r: any) => r.status === "answered").length,
        escalated: (reviews ?? []).filter((r: any) => r.status === "escalated").length,
        resolved: (reviews ?? []).filter((r: any) => r.status === "resolved").length,
      },
      reviews: (reviews ?? []).map((r: any) => ({ ...r, author: byId[r.user_id] ?? null })),
    };
  });

export const adminUpdateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; admin_reply?: string; status?: string; archived?: boolean; remove?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        admin_reply: z.string().max(4000).optional(),
        status: z.enum(["answered", "escalated", "resolved", "open"]).optional(),
        archived: z.boolean().optional(),
        remove: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await admin();
    if (data.remove) {
      await db.from("reviews").delete().eq("id", data.id);
      return { ok: true };
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.admin_reply !== undefined) patch.admin_reply = data.admin_reply;
    if (data.status !== undefined) patch.status = data.status;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { data: row } = await db.from("reviews").update(patch as any).eq("id", data.id).select("user_id").maybeSingle();
    if (data.admin_reply && row?.user_id) {
      await db.from("notifications").insert({
        user_id: row.user_id,
        title: "Reply from the Support Team",
        body: data.admin_reply,
        kind: "support",
      });
    }
    return { ok: true };
  });

export const adminListSupport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = await admin();
    const { data: rows } = await db
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean))];
    const { data: people } = ids.length
      ? await db.from("profiles").select("id,email,display_name,username").in("id", ids)
      : { data: [] as any[] };
    const byId = Object.fromEntries((people ?? []).map((p: any) => [p.id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, author: byId[r.user_id] ?? null }));
  });

export const adminUpdateSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; admin_reply?: string; status?: string; archived?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        admin_reply: z.string().max(4000).optional(),
        status: z.enum(["open", "resolved"]).optional(),
        archived: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = await admin();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.admin_reply !== undefined) patch.admin_reply = data.admin_reply;
    if (data.status !== undefined) patch.status = data.status;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { data: row } = await db
      .from("support_requests")
      .update(patch as any)
      .eq("id", data.id)
      .select("user_id")
      .maybeSingle();
    if (data.admin_reply && row?.user_id) {
      await db.from("notifications").insert({
        user_id: row.user_id,
        title: "Reply from the Support Team",
        body: data.admin_reply,
        kind: "support",
      });
    }
    return { ok: true };
  });

export const adminListErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = await admin();
    const { data } = await db
      .from("error_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
