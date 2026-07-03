import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { verifyPremiumPayment } from "@/lib/paystack.functions";

export const Route = createFileRoute("/_authenticated/upgrade/callback")({
  validateSearch: z.object({
    reference: z.string().optional(),
    trxref: z.string().optional(),
  }),
  component: UpgradeCallback,
});

function UpgradeCallback() {
  const search = useSearch({ from: "/_authenticated/upgrade/callback" });
  const navigate = useNavigate();
  const verifyFn = useServerFn(verifyPremiumPayment);
  const [state, setState] = useState<"verifying" | "ok" | "fail">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ref = search.reference || search.trxref;
    if (!ref) {
      setState("fail");
      setMessage("Missing payment reference.");
      return;
    }
    verifyFn({ data: { reference: ref } })
      .then((r) => {
        if (r.ok) {
          setState("ok");
          setMessage(r.message);
          setTimeout(() => navigate({ to: "/" }), 1800);
        } else {
          setState("fail");
          setMessage(r.message);
        }
      })
      .catch(() => {
        setState("fail");
        setMessage("Could not verify payment. Please contact support.");
      });
  }, [search.reference, search.trxref]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
        {state === "verifying" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-3 text-lg font-semibold">Verifying payment…</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please wait a moment.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="mt-3 text-lg font-semibold">Welcome to Premium!</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message} Redirecting…</p>
          </>
        )}
        {state === "fail" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-3 text-lg font-semibold">Payment not verified</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Back to app
            </button>
          </>
        )}
      </div>
    </div>
  );
}
