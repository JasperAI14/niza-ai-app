import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

function mask(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 6) return "•".repeat(value.length);
  return `${value.slice(0, 2)}${"•".repeat(Math.max(4, value.length - 6))}${value.slice(-4)}`;
}

/** Admin: returns config with secrets MASKED. Safe to render in UI. */
export const getNovaHubConfigMasked = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("nova_hub_config")
      .select("server_url, app_id, app_secret, webhook_secret, connected_at, last_error, updated_at")
      .eq("id", true)
      .maybeSingle();
    return {
      server_url: data?.server_url ?? "",
      app_id: data?.app_id ?? "",
      app_secret_masked: mask(data?.app_secret),
      webhook_secret_masked: mask(data?.webhook_secret),
      has_app_secret: !!data?.app_secret,
      has_webhook_secret: !!data?.webhook_secret,
      connected_at: data?.connected_at ?? null,
      last_error: data?.last_error ?? null,
      updated_at: data?.updated_at ?? null,
    };
  });

/** Admin: reveals raw secrets. Called only when the admin presses Reveal. */
export const revealNovaHubSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("nova_hub_config")
      .select("app_secret, webhook_secret")
      .eq("id", true)
      .maybeSingle();
    return {
      app_secret: data?.app_secret ?? "",
      webhook_secret: data?.webhook_secret ?? "",
    };
  });

/** Admin: save/update config. Empty secret string means "keep existing". */
export const saveNovaHubConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        server_url: z.string().trim().url().max(500),
        app_id: z.string().trim().min(1).max(200),
        app_secret: z.string().max(500).optional().default(""),
        webhook_secret: z.string().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: {
      server_url: string;
      app_id: string;
      updated_at: string;
      updated_by: string;
      app_secret?: string;
      webhook_secret?: string;
    } = {
      server_url: data.server_url,
      app_id: data.app_id,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.app_secret) update.app_secret = data.app_secret;
    if (data.webhook_secret) update.webhook_secret = data.webhook_secret;
    const { error } = await supabaseAdmin
      .from("nova_hub_config")
      .update(update)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin: press "Connect to Nova Hub". Validates config, pings the server. */
export const testNovaHubConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { loadNovaHubConfig, isConfigured, novaHubRequest } = await import("@/lib/novahub.server");
    const cfg = await loadNovaHubConfig();
    if (!isConfigured(cfg)) {
      return {
        ok: false as const,
        message: "Please fill in Server URL, App ID, App Secret, and Webhook Secret before connecting.",
      };
    }
    // Try a lightweight health probe. Nova Hub may not expose this yet — that's fine.
    const res = await novaHubRequest("/health", { method: "GET" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (res.ok) {
      await supabaseAdmin
        .from("nova_hub_config")
        .update({ connected_at: new Date().toISOString(), last_error: null })
        .eq("id", true);
      return { ok: true as const, message: "Connected to Nova Hub." };
    }
    await supabaseAdmin
      .from("nova_hub_config")
      .update({ last_error: res.error ?? `HTTP ${res.status}` })
      .eq("id", true);
    return {
      ok: false as const,
      message:
        res.status === 0
          ? "Nova Hub is unreachable right now. Your credentials are saved — try again later."
          : `Nova Hub responded ${res.status}. Credentials are saved; the service may still be under development.`,
    };
  });
