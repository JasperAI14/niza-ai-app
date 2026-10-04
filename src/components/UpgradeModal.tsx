import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { initializePremiumCheckout } from "@/lib/paystack.functions";
import { PLANS, PLAN_ORDER, formatNaira, type PlanTier } from "@/lib/plans";

type Props = {
  open: boolean;
  reason?: "text" | "image" | "both";
  onClose: () => void;
};

export function UpgradeInlineBanner({ open, reason, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"intro" | "plans" | "review">("intro");
  const [tier, setTier] = useState<PlanTier>("total");
  const initFn = useServerFn(initializePremiumCheckout);

  if (!open) return null;

  const label =
    reason === "image"
      ? "You've reached today's image limit."
      : reason === "text"
        ? "You've reached today's message limit."
        : "You've reached today's free limit.";

  async function upgrade() {
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/upgrade/callback`;
      const res = await initFn({ data: { callbackUrl, tier } });
      if (!res.ok) {
        toast.error(res.message);
        setLoading(false);
        return;
      }
      window.location.href = res.authorizationUrl;
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Upgrade to Premium"
      className="mx-auto mb-2 max-w-3xl overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-background to-background shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{label}</div>
          {step === "intro" && (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose a Premium plan for higher limits. Plans start at {formatNaira(PLANS.video.amountKobo)}/month.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button onClick={() => setStep("plans")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:opacity-90">
                  <Sparkles className="h-3.5 w-3.5" /> See Premium plans
                </button>
                <button onClick={onClose} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground">Maybe later</button>
              </div>
            </>
          )}
          {step === "plans" && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PLAN_ORDER.map((t) => (
                <button key={t} onClick={() => { setTier(t); setStep("review"); }} className={`rounded-xl border p-2.5 text-left transition hover:border-primary ${tier === t ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{PLANS[t].name}</span>
                    <span className="text-xs font-bold text-primary">{formatNaira(PLANS[t].amountKobo)}<span className="font-normal text-muted-foreground">/mo</span></span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                    {PLANS[t].features.map((f) => <li key={f}>• {f}</li>)}
                  </ul>
                </button>
              ))}
            </div>
          )}
          {step === "review" && (
            <div className="mt-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                You're buying <span className="font-medium text-foreground">{PLANS[tier].name}</span> for{" "}
                <span className="font-medium text-foreground">{formatNaira(PLANS[tier].amountKobo)}</span> — 31 days of access. You'll pay securely with Paystack.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={upgrade} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Pay {formatNaira(PLANS[tier].amountKobo)}
                </button>
                <button onClick={() => setStep("plans")} disabled={loading} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground">Change plan</button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
