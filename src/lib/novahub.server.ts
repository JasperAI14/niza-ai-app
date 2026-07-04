// Server-only Nova Hub integration helpers.
// Reads configuration from public.nova_hub_config (admin-managed) and
// exposes signed request + webhook verification primitives.
// Endpoint paths are intentionally NOT hardcoded — callers pass the path
// once Nova Hub's API surface is finalized.

import { createHmac, timingSafeEqual } from "node:crypto";

export type NovaHubConfig = {
  server_url: string | null;
  app_id: string | null;
  app_secret: string | null;
  webhook_secret: string | null;
};

export async function loadNovaHubConfig(): Promise<NovaHubConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("nova_hub_config")
    .select("server_url, app_id, app_secret, webhook_secret")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as NovaHubConfig;
}

export type LoadedNovaHubConfig = {
  server_url: string;
  app_id: string;
  app_secret: string;
  webhook_secret: string;
};

export function isConfigured(cfg: NovaHubConfig | null): cfg is LoadedNovaHubConfig {
  return !!(cfg?.server_url && cfg.app_id && cfg.app_secret && cfg.webhook_secret);
}

/**
 * Send a signed request to Nova Hub. Automatically attaches App ID / App Secret
 * on every call. `path` is appended to the configured server URL.
 * Returns { ok, status, data?, error? } — never throws for network failure.
 */
export async function novaHubRequest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const cfg = await loadNovaHubConfig();
  if (!isConfigured(cfg)) {
    return { ok: false, status: 0, error: "Nova Hub is not configured yet." };
  }
  const base = cfg.server_url.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (init.method ?? "GET").toUpperCase();
  const bodyStr = init.body === undefined ? undefined : JSON.stringify(init.body);

  // Sign timestamp + method + path + body with the App Secret so Nova Hub
  // can verify origin + integrity without relying on TLS alone.
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", cfg.app_secret)
    .update(`${timestamp}.${method}.${path}.${bodyStr ?? ""}`)
    .digest("hex");

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-app-id": cfg.app_id,
        "x-app-secret": cfg.app_secret,
        "x-nova-timestamp": timestamp,
        "x-nova-signature": signature,
        ...(init.headers ?? {}),
      },
      body: bodyStr,
    });
    const text = await res.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data: data as T, error: `Nova Hub responded ${res.status}` };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Verify an incoming Nova Hub webhook. Expects the raw request body and
 * the signature header value. Uses HMAC-SHA256 with the Webhook Secret,
 * constant-time compared.
 */
export async function verifyNovaHubWebhook(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const cfg = await loadNovaHubConfig();
  if (!cfg?.webhook_secret) return false;
  const expected = createHmac("sha256", cfg.webhook_secret).update(rawBody).digest("hex");
  const given = signatureHeader.replace(/^sha256=/, "").trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
