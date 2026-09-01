import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { TUTORIAL_STEPS } from "@/lib/docs-content";
import { BrandLogo } from "./BrandLogo";

export const TUTORIAL_SEEN_KEY = "niza.tutorial.seen";

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export function hasSeenTutorial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = TUTORIAL_STEPS[i];
  const last = i === TUTORIAL_STEPS.length - 1;

  function close() {
    markTutorialSeen();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <BrandLogo size={36} withWordmark subtitle="Quick tour" />
          <button
            onClick={close}
            aria-label="Dismiss tutorial"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="text-lg font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-5 flex items-center gap-1.5">
          {TUTORIAL_STEPS.map((s, n) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-primary" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={close} className="text-xs text-muted-foreground underline">
            Skip
          </button>
          <button
            onClick={() => (last ? close() : setI((v) => v + 1))}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {last ? "Start using Niza" : "Next"} {!last && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
