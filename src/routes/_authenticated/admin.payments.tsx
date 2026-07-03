import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, KeyRound, Wifi, Package } from "lucide-react";
import {
  getPaystackStatus,
  testPaystackConnection,
  createOrRefreshPremiumPlan,
} from "@/lib/paystack.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getPaystackStatus);
  const testFn = useServerFn(testPaystackConnection);
  const planFn = useServerFn(createOrRefreshPremiumPlan);

  const statusQ = useQuery({
    queryKey: ["paystack-status"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const testMut = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: () => toast.error("Connection test failed."),
  });

  const planMut = useMutation({
    mutationFn: () => planFn(),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.message);
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["paystack-status"] });
    },
    onError: () => toast.error("Could not create the plan."),
  });

  if (statusQ.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (statusQ.isError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          You don't have permission to view Payment Settings.
        </div>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          &larr; Back to app
        </Link>
      </div>
    );
  }

  const s = statusQ.data!;
  const liveReady = s.mode === "live" && s.hasSecret && s.hasPublic;
  const anyConfigured = s.hasSecret || s.hasPublic;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to app
      </Link>
      <h1 className="text-2xl font-semibold">Payment Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage Paystack keys and the NovaMind AI Premium plan.
      </p>

      {/* Mode banner */}
      <div
        className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${
          liveReady
            ? "border-emerald-500/40 bg-emerald-500/10"
            : anyConfigured
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-destructive/40 bg-destructive/10"
        }`}
      >
        {liveReady ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
        )}
        <div className="text-sm">
          <div className="font-medium">
            Mode:{" "}
            <span className={liveReady ? "text-emerald-500" : anyConfigured ? "text-amber-500" : "text-destructive"}>
              {s.mode === "live" ? "LIVE" : s.mode === "test" ? "TEST" : "NOT CONFIGURED"}
            </span>
          </div>
          {!s.hasSecret && (
            <p className="mt-1 text-muted-foreground">
              No Paystack secret key is configured. Live payments will not work until it's added.
            </p>
          )}
          {s.mode === "test" && (
            <p className="mt-1 text-muted-foreground">
              A test key is configured. Add your live secret key to accept real payments.
            </p>
          )}
          {liveReady && <p className="mt-1 text-muted-foreground">Live payments are enabled.</p>}
        </div>
      </div>

      {/* Keys */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4" /> Keys
        </h2>
        <KeyRow label="Paystack Secret Key" configured={s.hasSecret} masked={s.secretMasked} secretName="PAYSTACK_SECRET_KEY" />
        <KeyRow label="Paystack Public Key" configured={s.hasPublic} masked={s.publicMasked} secretName="PAYSTACK_PUBLIC_KEY" />
        <KeyRow label="Webhook Secret (optional)" configured={s.hasWebhookSecret} masked={null} secretName="PAYSTACK_WEBHOOK_SECRET" />
        <p className="mt-3 text-xs text-muted-foreground">
          Keys are stored securely on the server and are never sent to the browser. To rotate a key,
          update the corresponding secret in your project settings.
        </p>
      </section>

      {/* Connection test */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wifi className="h-4 w-4" /> Test connection
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Verifies that the configured secret key can reach the Paystack API.
        </p>
        <button
          onClick={() => testMut.mutate()}
          disabled={testMut.isPending || !s.hasSecret}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          Test Paystack Connection
        </button>
      </section>

      {/* Premium plan */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" /> NovaMind AI Premium plan
        </h2>
        <div className="text-sm">
          <div>
            <span className="text-muted-foreground">Price:</span>{" "}
            <span className="font-medium">₦{(s.planAmountKobo / 100).toLocaleString()}/month</span>
          </div>
          <div className="mt-1">
            <span className="text-muted-foreground">Plan code:</span>{" "}
            {s.planCode ? (
              <span className="font-mono text-xs">{s.planCode}</span>
            ) : (
              <span className="text-amber-500">not created yet</span>
            )}
          </div>
        </div>
        <button
          onClick={() => planMut.mutate()}
          disabled={planMut.isPending || !s.hasSecret}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {planMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          {s.planCode ? "Verify / refresh plan on Paystack" : "Create Premium plan on Paystack"}
        </button>
      </section>

      {/* Webhook URL */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Webhook URL</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          In your Paystack dashboard, set this webhook URL under Settings → API Keys &amp; Webhooks:
        </p>
        <WebhookUrl />
      </section>
    </div>
  );
}

function KeyRow(props: { label: string; configured: boolean; masked: string | null; secretName: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
      <div>
        <div className="text-sm">{props.label}</div>
        <div className="text-xs text-muted-foreground">
          {props.configured ? (props.masked ? `Stored: ${props.masked}` : "Stored securely.") : "Not set."}
          <span className="ml-2 font-mono opacity-60">{props.secretName}</span>
        </div>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          props.configured ? "bg-emerald-500/20 text-emerald-500" : "bg-destructive/20 text-destructive"
        }`}
      >
        {props.configured ? "SET" : "MISSING"}
      </span>
    </div>
  );
}

function WebhookUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/api/public/paystack/webhook`);
  }, []);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
      />
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast.success("Webhook URL copied");
        }}
        className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
      >
        Copy
      </button>
    </div>
  );
}
