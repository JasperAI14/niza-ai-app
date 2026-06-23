import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useServerFn } from "@tanstack/react-start";
import { submitPromo, getMe } from "@/lib/chat.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NovaMind AI" },
      { name: "description", content: "Sign in to NovaMind AI with Google." },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [phase, setPhase] = useState<"signin" | "promo" | "loading">("loading");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchMe = useServerFn(getMe);
  const sendPromo = useServerFn(submitPromo);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setPhase("signin");
        return;
      }
      // Already signed in — check promo status
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (me.profile.promo_used) {
          router.invalidate();
          navigate({ to: "/" });
        } else {
          setPhase("promo");
        }
      } catch {
        setPhase("signin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signInGoogle() {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) {
      toast.error("Sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (r.redirected) return;
    // Signed in — check promo
    try {
      const me = await fetchMe();
      if (me.profile.promo_used) {
        router.invalidate();
        navigate({ to: "/" });
      } else {
        setPhase("promo");
      }
    } catch {
      setPhase("promo");
    }
    setBusy(false);
  }

  async function handlePromo(skip: boolean) {
    setBusy(true);
    const r = await sendPromo({ data: { code: skip ? "" : code } });
    if (r.ok) {
      toast.success(r.message);
      router.invalidate();
      navigate({ to: "/" });
    } else {
      toast.error(r.message);
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold">
            N
          </div>
          <h1 className="text-2xl font-bold">NovaMind AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chat, code, and create images — all in one.</p>
        </div>

        {phase === "loading" && (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {phase === "signin" && (
          <button
            onClick={signInGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.1z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.2C40.9 35.6 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            {busy ? "Signing in…" : "Continue with Google"}
          </button>
        )}

        {phase === "promo" && (
          <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              Have a promo code? Enter it now — this is your only chance.
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Promo code (optional)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              disabled={busy}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handlePromo(true)}
                disabled={busy}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={() => handlePromo(false)}
                disabled={busy || !code.trim()}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
