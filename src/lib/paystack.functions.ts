import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYSTACK_BASE = "https://api.paystack.co";

// ---------- shared helpers ----------
function getSecretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

function isLiveKey(k: string | null): boolean {
  return !!k && k.startsWith("sk_live_");
}

async function paystackFetch(path: string, init: RequestInit = {}) {
  const key = getSecretKey();
  if (!key) throw new Error("Paystack secret key not configured");
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

// ---------- ADMIN: config status ----------
export const getPaystackStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const secret = getSecretKey();
    const publicKey = process.env.PAYSTACK_PUBLIC_KEY || null;
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("paystack_plan_code, paystack_plan_amount_kobo, updated_at")
      .eq("id", true)
      .maybeSingle();

    return {
      hasSecret: !!secret,
      hasPublic: !!publicKey,
      hasWebhookSecret: !!webhookSecret,
      mode: isLiveKey(secret) ? ("live" as const) : secret ? ("test" as const) : ("none" as const),
      secretMasked: secret ? `${secret.slice(0, 8)}…${secret.slice(-4)}` : null,
      publicMasked: publicKey ? `${publicKey.slice(0, 8)}…${publicKey.slice(-4)}` : null,
      planCode: settings?.paystack_plan_code ?? null,
      planAmountKobo: settings?.paystack_plan_amount_kobo ?? 500000,
      updatedAt: settings?.updated_at ?? null,
    };
  });

// ---------- ADMIN: test connection ----------
export const testPaystackConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    if (!getSecretKey()) {
      return { ok: false as const, message: "No Paystack secret key configured." };
    }
    try {
      const r = await paystackFetch("/bank?currency=NGN&perPage=1");
      if (!r.ok) {
        const msg = (r.json as any)?.message || `Paystack returned ${r.status}`;
        return { ok: false as const, message: msg };
      }
      return {
        ok: true as const,
        mode: isLiveKey(getSecretKey()) ? "live" : "test",
        message: "Connection verified.",
      };
    } catch {
      return { ok: false as const, message: "Could not reach Paystack." };
    }
  });

// ---------- ADMIN: create or refresh Premium plan on Paystack ----------
export const createOrRefreshPremiumPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    if (!getSecretKey()) return { ok: false as const, message: "Configure Paystack keys first." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("paystack_plan_code, paystack_plan_amount_kobo")
      .eq("id", true)
      .maybeSingle();

    const amount = existing?.paystack_plan_amount_kobo ?? 500000; // ₦5,000

    // If we already have a plan_code, verify it exists on Paystack
    if (existing?.paystack_plan_code) {
      const r = await paystackFetch(`/plan/${existing.paystack_plan_code}`);
      if (r.ok) {
        return {
          ok: true as const,
          planCode: existing.paystack_plan_code,
          message: "Plan already configured.",
        };
      }
    }

    const r = await paystackFetch("/plan", {
      method: "POST",
      body: JSON.stringify({
        name: "Niza AI Premium",
        interval: "monthly",
        amount,
        currency: "NGN",
        description: "Unlock unlimited AI conversations and higher daily limits.",
      }),
    });
    if (!r.ok) {
      const msg = (r.json as any)?.message || `Paystack returned ${r.status}`;
      return { ok: false as const, message: msg };
    }
    const planCode = (r.json as any)?.data?.plan_code as string;
    await supabaseAdmin
      .from("app_settings")
      .update({ paystack_plan_code: planCode, updated_at: new Date().toISOString() })
      .eq("id", true);
    return { ok: true as const, planCode, message: "Plan created on Paystack." };
  });

// ---------- USER: my premium status ----------
export const getMyPremiumStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("plan, plan_status, plan_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      plan: (data?.plan ?? "free") as "free" | "premium",
      status: (data?.plan_status ?? "inactive") as string,
      expiresAt: (data?.plan_expires_at ?? null) as string | null,
    };
  });

// ---------- USER: initialize checkout ----------
export const initializePremiumCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ callbackUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!getSecretKey()) {
      return { ok: false as const, message: "Payments are not yet configured. Please contact support." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("profiles").select("email").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("app_settings").select("paystack_plan_code, paystack_plan_amount_kobo").eq("id", true).maybeSingle(),
    ]);
    if (!profile?.email) return { ok: false as const, message: "Your account is missing an email address." };

    const body: Record<string, unknown> = {
      email: profile.email,
      callback_url: data.callbackUrl,
      metadata: { user_id: context.userId, purpose: "premium_subscription" },
    };
    if (settings?.paystack_plan_code) {
      body.plan = settings.paystack_plan_code;
    } else {
      body.amount = settings?.paystack_plan_amount_kobo ?? 500000;
      body.currency = "NGN";
    }

    const r = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      return { ok: false as const, message: (r.json as any)?.message || "Could not start checkout." };
    }
    const authorizationUrl = (r.json as any)?.data?.authorization_url as string;
    const reference = (r.json as any)?.data?.reference as string;
    return { ok: true as const, authorizationUrl, reference };
  });

// ---------- USER: verify payment (called from callback page) ----------
export const verifyPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reference: z.string().min(3).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!getSecretKey()) return { ok: false as const, message: "Payments not configured." };
    const r = await paystackFetch(`/transaction/verify/${encodeURIComponent(data.reference)}`);
    if (!r.ok) return { ok: false as const, message: "Verification failed." };
    const payload = (r.json as any)?.data;
    if (payload?.status !== "success") {
      return { ok: false as const, message: `Payment ${payload?.status ?? "not successful"}.` };
    }
    // Guard: metadata user_id must match caller
    const metaUserId = payload?.metadata?.user_id;
    if (metaUserId && metaUserId !== context.userId) {
      return { ok: false as const, message: "This payment does not belong to your account." };
    }
    await activatePremium({
      userId: context.userId,
      customerCode: payload?.customer?.customer_code ?? null,
      subscriptionCode: null,
      amountKobo: payload?.amount ?? null,
      reference: payload?.reference ?? data.reference,
      rawEvent: payload,
    });
    return { ok: true as const, message: "Premium activated." };
  });

// Shared: mark a user premium for ~31 days from now (or extend beyond).
export async function activatePremium(opts: {
  userId: string;
  customerCode: string | null;
  subscriptionCode: string | null;
  amountKobo: number | null;
  reference: string;
  rawEvent: unknown;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotency: if we've already activated for this reference, do nothing.
  if (opts.reference) {
    const { data: dup } = await supabaseAdmin
      .from("payment_events")
      .select("id")
      .eq("event_type", "premium.activated")
      .eq("reference", opts.reference)
      .maybeSingle();
    if (dup) return;
  }

  const { data: current } = await supabaseAdmin
    .from("profiles")
    .select("plan_expires_at")
    .eq("id", opts.userId)
    .maybeSingle();
  const base = current?.plan_expires_at ? new Date(current.plan_expires_at) : new Date();
  const from = base.getTime() > Date.now() ? base : new Date();
  const expires = new Date(from.getTime() + 31 * 24 * 60 * 60 * 1000);

  await supabaseAdmin
    .from("profiles")
    .update({
      plan: "premium",
      plan_status: "active",
      plan_expires_at: expires.toISOString(),
      ...(opts.customerCode ? { paystack_customer_code: opts.customerCode } : {}),
      ...(opts.subscriptionCode ? { paystack_subscription_code: opts.subscriptionCode } : {}),
    })
    .eq("id", opts.userId);

  const { error: insertErr } = await supabaseAdmin.from("payment_events").insert({
    user_id: opts.userId,
    event_type: "premium.activated",
    reference: opts.reference,
    amount_kobo: opts.amountKobo,
    raw: opts.rawEvent as any,
  });
  // Unique-index race: another concurrent webhook won — safe to swallow.
  if (insertErr && !String(insertErr.message || "").includes("duplicate")) {
    throw insertErr;
  }
}

