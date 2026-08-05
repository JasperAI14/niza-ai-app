// Niza Prime AI theme system — persisted in localStorage, applied to <html>.

export type ThemeMode = "system" | "dark" | "light";
export type AccentKey = "violet" | "cyan" | "emerald" | "amber" | "rose";

export const ACCENTS: Record<AccentKey, { label: string; primary: string; swatch: string }> = {
  violet: { label: "Electric Violet", primary: "oklch(0.68 0.24 302)", swatch: "#9B5CFF" },
  cyan: { label: "Neon Cyan", primary: "oklch(0.75 0.16 205)", swatch: "#22C7E0" },
  emerald: { label: "Emerald", primary: "oklch(0.72 0.17 158)", swatch: "#1FBF87" },
  amber: { label: "Amber", primary: "oklch(0.78 0.17 75)", swatch: "#E9A23B" },
  rose: { label: "Rose", primary: "oklch(0.68 0.21 15)", swatch: "#F0577A" },
};

export type FontScale = "sm" | "md" | "lg";
export const FONT_SCALES: Record<FontScale, { label: string; px: number }> = {
  sm: { label: "Compact", px: 14 },
  md: { label: "Default", px: 15 },
  lg: { label: "Large", px: 17 },
};

export type ThemeSettings = { mode: ThemeMode; accent: AccentKey; scale: FontScale };

const KEY = "nm_theme";
export const DEFAULT_THEME: ThemeSettings = { mode: "dark", accent: "violet", scale: "md" };

export function readTheme(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    return {
      mode: parsed.mode ?? DEFAULT_THEME.mode,
      accent: parsed.accent && parsed.accent in ACCENTS ? parsed.accent : DEFAULT_THEME.accent,
      scale: parsed.scale && parsed.scale in FONT_SCALES ? parsed.scale : DEFAULT_THEME.scale,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(t: ThemeSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

export function applyTheme(t: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = t.mode === "dark" || (t.mode === "system" && prefersDark);
  root.classList.toggle("dark", dark);

  const accent = ACCENTS[t.accent]?.primary ?? ACCENTS.violet.primary;
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--sidebar-primary", accent);
  root.style.setProperty("--sidebar-ring", accent);
  root.style.setProperty("--nm-chat-size", `${FONT_SCALES[t.scale].px}px`);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#121212" : "#ffffff");
}
