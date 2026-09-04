// Niza Prime AI theme system.
//
// The base appearance is a fixed white / light-cream design. The only
// user-customizable visual setting is the accent color, persisted locally.

export type AccentKey = "indigo" | "violet" | "azure" | "teal" | "amber" | "rose";

export const ACCENTS: Record<AccentKey, { label: string; primary: string; swatch: string }> = {
  indigo: { label: "Prime Blue", primary: "oklch(0.62 0.14 275)", swatch: "#7F8CE3" },
  violet: { label: "Violet", primary: "oklch(0.53 0.21 300)", swatch: "#8347D9" },
  azure: { label: "Azure", primary: "oklch(0.56 0.16 245)", swatch: "#3F7FD8" },
  teal: { label: "Teal", primary: "oklch(0.55 0.11 190)", swatch: "#2E9095" },
  amber: { label: "Amber", primary: "oklch(0.62 0.14 70)", swatch: "#B4762A" },
  rose: { label: "Rose", primary: "oklch(0.56 0.19 15)", swatch: "#CF4A63" },
};

export const DEFAULT_ACCENT: AccentKey = "indigo";

const KEY = "nm_accent";

export function readAccent(): AccentKey {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw in ACCENTS) return raw as AccentKey;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_ACCENT;
}

export function writeAccent(accent: AccentKey) {
  try {
    localStorage.setItem(KEY, accent);
  } catch {
    /* storage unavailable — accent still applies for this session */
  }
}

export function applyAccent(accent: AccentKey) {
  if (typeof document === "undefined") return;
  const value = ACCENTS[accent]?.primary ?? ACCENTS[DEFAULT_ACCENT].primary;
  const root = document.documentElement;
  root.classList.remove("dark");
  root.style.setProperty("--primary", value);
  root.style.setProperty("--ring", value);
  root.style.setProperty("--sidebar-primary", value);
  root.style.setProperty("--sidebar-ring", value);
}
