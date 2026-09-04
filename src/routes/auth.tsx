import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useServerFn } from "@tanstack/react-start";
import { submitPromo, getMe } from "@/lib/chat.functions";
import { isInAppWebView } from "@/lib/image-utils";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Niza Prime AI" },
      { name: "description", content: "Sign in to Niza Prime AI with Google, email, or a magic link." },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

type Mode = "signin" | "signup" | "magic" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [phase, setPhase] = useState<"signin" | "promo" | "loading">("loading");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const fetchMe = useServerFn(getMe);
  const sendPromo = useServerFn(submitPromo);

  const inWebView = useMemo(() => isInAppWebView(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setPhase("signin");
        if (inWebView) setMode("signin");
        return;
      }
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

  async function afterSignedIn() {
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
  }

  async function signInGoogle() {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) {
      toast.error("Google sign-in unavailable here. Try email instead.");
      setBusy(false);
      setMode("signin");
      return;
    }
    if (r.redirected) return;
    await afterSignedIn();
    setBusy(false);
  }

  async function emailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return toast.error(error.message);
    await afterSignedIn();
  }

  async function emailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin + "/auth" },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
    setMode("signin");
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/auth" },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Magic link sent. Check your email.");
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent.");
    setMode("signin");
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
          <BrandLogo size={64} />
          <h1 className="text-2xl font-bold">Niza Prime AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chat, code, and create images — all in one.</p>
        </div>

        {phase === "loading" && (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {phase === "signin" && (
          <div className="space-y-4">
            {!inWebView && (
              <>
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            {inWebView && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Google Sign-In is blocked inside in-app browsers. Use email or a magic link below.
              </div>
            )}

            <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
              {([
                ["signin", "Sign in"],
                ["signup", "Create account"],
                ["magic", "Magic link"],
              ] as [Mode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
                    mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "signin" && (
              <form onSubmit={emailSignIn} className="space-y-2">
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <button type="button" onClick={() => setMode("forgot")} className="w-full text-center text-xs text-muted-foreground hover:underline">
                  Forgot password?
                </button>
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={emailSignUp} className="space-y-2">
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {busy ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}

            {mode === "magic" && (
              <form onSubmit={magicLink} className="space-y-2">
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {busy ? "Sending…" : "Email me a magic link"}
                </button>
                <p className="text-center text-xs text-muted-foreground">We'll send a one-tap sign-in link.</p>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={forgot} className="space-y-2">
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {busy ? "Sending…" : "Send password reset email"}
                </button>
                <button type="button" onClick={() => setMode("signin")} className="w-full text-center text-xs text-muted-foreground hover:underline">
                  Back to sign in
                </button>
              </form>
            )}
          </div>
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
