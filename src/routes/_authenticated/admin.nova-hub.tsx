import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Save, Wifi } from "lucide-react";
import {
  getNovaHubConfigMasked,
  revealNovaHubSecrets,
  saveNovaHubConfig,
  testNovaHubConnection,
} from "@/lib/novahub.functions";

export const Route = createFileRoute("/_authenticated/admin/nova-hub")({
  head: () => ({
    meta: [
      { title: "Nova Hub Integration — Admin" },
      { name: "description", content: "Configure the Nova Hub server URL and credentials." },
    ],
  }),
  component: NovaHubAdmin,
});

function NovaHubAdmin() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getNovaHubConfigMasked);
  const revealFn = useServerFn(revealNovaHubSecrets);
  const saveFn = useServerFn(saveNovaHubConfig);
  const testFn = useServerFn(testNovaHubConnection);

  const statusQ = useQuery({
    queryKey: ["novahub-status"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const [serverUrl, setServerUrl] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!statusQ.data) return;
    setServerUrl(statusQ.data.server_url ?? "");
    setAppId(statusQ.data.app_id ?? "");
    // Leave secret fields blank; masked placeholders show existing values.
  }, [statusQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          server_url: serverUrl.trim(),
          app_id: appId.trim(),
          app_secret: appSecret,
          webhook_secret: webhookSecret,
        },
      }),
    onSuccess: () => {
      toast.success("Nova Hub settings saved.");
      setAppSecret("");
      setWebhookSecret("");
      setRevealed(false);
      setShowAppSecret(false);
      setShowWebhookSecret(false);
      qc.invalidateQueries({ queryKey: ["novahub-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save settings."),
  });

  const testMut = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: () => toast.error("Could not reach Nova Hub. Please try again later."),
    onSettled: () => qc.invalidateQueries({ queryKey: ["novahub-status"] }),
  });

  async function handleReveal() {
    if (revealed) {
      setAppSecret("");
      setWebhookSecret("");
      setShowAppSecret(false);
      setShowWebhookSecret(false);
      setRevealed(false);
      return;
    }
    try {
      const s = await revealFn();
      setAppSecret(s.app_secret);
      setWebhookSecret(s.webhook_secret);
      setShowAppSecret(true);
      setShowWebhookSecret(true);
      setRevealed(true);
    } catch {
      toast.error("Could not reveal secrets.");
    }
  }

  const status = statusQ.data;
  const canSave =
    serverUrl.trim().length > 0 &&
    appId.trim().length > 0 &&
    (revealed
      ? appSecret.length > 0 && webhookSecret.length > 0
      : (status?.has_app_secret || appSecret.length > 0) &&
        (status?.has_webhook_secret || webhookSecret.length > 0));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="text-2xl font-bold">Nova Hub Integration</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure the connection to your Nova Hub server. Authentication, subscription checks,
        and payments will use these credentials automatically once Nova Hub is live.
      </p>

      {statusQ.isLoading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      )}

      {status && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {status.connected_at ? "Last connected" : "Not connected yet"}
              </div>
              <div className="text-xs text-muted-foreground">
                {status.connected_at
                  ? new Date(status.connected_at).toLocaleString()
                  : "Save credentials and press Connect to Nova Hub."}
              </div>
              {status.last_error && (
                <div className="mt-1 text-xs text-amber-600">Last error: {status.last_error}</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Nova Hub Server URL">
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://novahub.example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <Field label="App ID">
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="app_..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>

            <SecretField
              label="App Secret Key"
              value={appSecret}
              onChange={setAppSecret}
              show={showAppSecret}
              onToggleShow={() => setShowAppSecret((v) => !v)}
              placeholder={status.has_app_secret ? status.app_secret_masked : "Paste App Secret Key"}
              alreadyStored={status.has_app_secret && !revealed && appSecret === ""}
            />

            <SecretField
              label="Webhook Secret Key"
              value={webhookSecret}
              onChange={setWebhookSecret}
              show={showWebhookSecret}
              onToggleShow={() => setShowWebhookSecret((v) => !v)}
              placeholder={
                status.has_webhook_secret ? status.webhook_secret_masked : "Paste Webhook Secret Key"
              }
              alreadyStored={status.has_webhook_secret && !revealed && webhookSecret === ""}
            />

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReveal}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
                disabled={!status.has_app_secret && !status.has_webhook_secret}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {revealed ? "Hide secrets" : "Reveal secrets"}
              </button>

              <button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={!canSave || saveMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save settings
              </button>

              <button
                type="button"
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Connect to Nova Hub
              </button>
            </div>

            <p className="pt-2 text-xs text-muted-foreground">
              Secrets are stored server-side and never sent to the browser unless you press Reveal.
              Every request to Nova Hub automatically includes your App ID and App Secret, and every
              incoming webhook is verified with the Webhook Secret before being trusted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function SecretField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  alreadyStored: boolean;
}) {
  return (
    <Field label={props.label}>
      <div className="relative">
        <input
          type={props.show ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={props.onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={props.show ? "Hide" : "Show"}
        >
          {props.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {props.alreadyStored && (
        <div className="mt-1 text-xs text-muted-foreground">
          A value is already saved. Leave blank to keep it, or type a new one to replace it.
        </div>
      )}
    </Field>
  );
}
