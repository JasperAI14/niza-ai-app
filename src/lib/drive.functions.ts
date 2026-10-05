import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR = "google_drive";
// drive.file: Niza only sees files it creates — never the rest of the user's Drive.
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.file",
];
const FOLDER_NAME = "Niza Prime AI";

export type DriveStatus =
  | { connected: false; reconnectRequired?: boolean }
  | { connected: true; email: string | null; folderId: string | null };

async function drive(connectionKey: string, path: string, init?: RequestInit) {
  const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY,
    connectionAPIKey: connectionKey,
    connectorId: CONNECTOR,
    path,
    init,
    requiredScopes: SCOPES,
  });
}

/** Find or create the user's private "Niza Prime AI" folder. */
async function ensureFolder(connectionKey: string, existing: string | null): Promise<string> {
  if (existing) {
    const r = await drive(connectionKey, `/drive/v3/files/${existing}?fields=id,trashed`);
    if (r.ok) {
      const f = (await r.json()) as { trashed?: boolean };
      if (!f.trashed) return existing;
    }
  }
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const list = await drive(connectionKey, `/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`);
  if (list.ok) {
    const j = (await list.json()) as { files?: { id: string }[] };
    if (j.files?.[0]?.id) return j.files[0].id;
  }
  const c = await drive(connectionKey, "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!c.ok) {
    console.error("Drive folder create failed", c.status, await c.text());
    throw new Error("Could not create your Niza Prime AI folder in Google Drive.");
  }
  return ((await c.json()) as { id: string }).id;
}

export const getDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveStatus> => {
    const { getConnection, updateConnection } = await import("./connections.server");
    const row = await getConnection(context.userId, CONNECTOR);
    if (!row) return { connected: false };
    if (row.reconnect_required) return { connected: false, reconnectRequired: true };
    const { appUserReconnectRequired } = await import("@/integrations/lovable/appUserConnector");
    const res = await drive(row.connectionKey, "/drive/v3/about?fields=user(emailAddress)");
    if (await appUserReconnectRequired(res)) {
      await updateConnection(context.userId, CONNECTOR, { reconnect_required: true });
      return { connected: false, reconnectRequired: true };
    }
    if (!res.ok) {
      console.error("Drive status failed", res.status, await res.text());
      throw new Error("Couldn't reach Google Drive right now. Please try again.");
    }
    const j = (await res.json()) as { user?: { emailAddress?: string } };
    const email = j.user?.emailAddress ?? row.account_email;
    if (email !== row.account_email) await updateConnection(context.userId, CONNECTOR, { account_email: email });
    return { connected: true, email, folderId: row.folder_id };
  });

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientKey = process.env['GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) throw new Error("Google Drive isn't set up yet.");
    const request = getRequest();
    if (!request) throw new Error("Connection must start from the app.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/oauth/google-drive/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const { getConnection } = await import("./connections.server");
    const existing = await getConnection(context.userId, CONNECTOR).catch(() => null);
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY,
      connectorId: CONNECTOR,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing?.connectionKey,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const completeDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY, data.code);
    if (connectorId !== CONNECTOR) throw new Error("Wrong service returned.");
    const { saveConnection, getConnection, updateConnection } = await import("./connections.server");
    await saveConnection(context.userId, CONNECTOR, connectionAPIKey);
    // Verify the grant works and set up the user's own folder.
    const row = await getConnection(context.userId, CONNECTOR);
    const folderId = await ensureFolder(connectionAPIKey, row?.folder_id ?? null);
    await updateConnection(context.userId, CONNECTOR, { folder_id: folderId });
    return { ok: true };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnection, deleteConnection } = await import("./connections.server");
    const row = await getConnection(context.userId, CONNECTOR);
    if (row) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      try {
        await disconnectAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: row.connectionKey, connectorId: CONNECTOR });
      } catch (e) {
        // Access already revoked on Google's side — still remove our record.
        console.error(e);
      }
      await deleteConnection(context.userId, CONNECTOR);
    }
    return { ok: true };
  });
