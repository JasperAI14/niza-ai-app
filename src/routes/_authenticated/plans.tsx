import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, X, Check, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  initializePremiumCheckout,
  getMyPremiumStatus,
} from "@/lib/paystack.functions";
import { PLANS, PLAN_ORDER, formatNaira, type PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/plans")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Premium Plans — Niza Prime AI" },
      {
        name: "description",
        content:
          "Choose an affordable Niza Prime AI plan: Total Premium, Chat Premium, Images Premium or Video Editing Premium.",
      },
    ],
  }),
  component: PlansPage,
});

const TIER_HIGHLIGHT: Record<PlanTier, string> = {
  total: "Best value — everything unlocked",
  chat: "More AI chats every day",
  images: "Unlimited image generations",
  video: "AI video editing in chat",
};

function PlansPage() {
  const navigate = useNavigate();
  const initFn = useServerFn(initializePremiumCheckout);
  const statusFn = useServerFn(getMyPremiumStatus);
  const statusQ = useQuery({ queryKey: ["premium-status"], queryFn: () => statusFn() });
  const [selected, setSelected] = useState<PlanTier | null>(null);
  const [loading, setLoading] = useState(false);

  const currentTier = (statusQ.data?.tier ?? null) as PlanTier | null;
  const isPremium = statusQ.data?.plan === "premium" && statusQ.data?.status === "active";

  async function pay(tier: PlanTier) {
    setLoading(true);
    try {
      const res = await initFn({
        data: { callbackUrl: `${window.location.origin}/upgrade/callback`, tier },
      });
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
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <h1 className="truncate text-base font-bold sm:text-lg">Premium Plans</h1>
          </div>
          <button
            onClick={() => navigate({ to: "/chat" })}
            aria-label="Back to chat"
            className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-5">
        {isPremium && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm">
            <Crown className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0">
              Your <span className="font-semibold">{currentTier ? PLANS[currentTier].name : "Premium"}</span> plan
              is active{statusQ.data?.expiresAt ? ` until ${new Date(statusQ.data.expiresAt).toLocaleDateString()}` : ""}.
              You can extend it or add another plan below.
            </span>
          </div>
        )}

        <p className="mb-5 text-sm text-muted-foreground">
          Four affordable plans — pick exactly what you need. Each plan lasts 31 days. Image
          generation is a Premium feature: choose Images Premium (or Total Premium) to unlock it.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((tier) => {
            const p = PLANS[tier];
            const active = isPremium && currentTier === tier;
            return (
              <button
                key={tier}
                onClick={() => setSelected(tier)}
                aria-pressed={selected === tier}
                className={`flex flex-col rounded-2xl border p-4 text-left transition ${
                  selected === tier
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-sm font-bold">{p.name}</span>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <div className="mt-1 text-2xl font-black tracking-tight">
                  {formatNaira(p.amountKobo)}
                  <span className="text-xs font-medium text-muted-foreground"> / 31 days</span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-primary">{TIER_HIGHLIGHT[tier]}</div>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span className="min-w-0">{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-6 rounded-2xl border border-primary/40 bg-card p-4 shadow-lg shadow-primary/5">
            <h2 className="text-sm font-semibold">Review your order</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're buying <span className="font-medium text-foreground">{PLANS[selected].name}</span> for{" "}
              <span className="font-medium text-foreground">{formatNaira(PLANS[selected].amountKobo)}</span> —
              31 days of access. You'll pay securely with Paystack.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => pay(selected)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Pay {formatNaira(PLANS[selected].amountKobo)}
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={loading}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-60"
              >
                Change plan
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
