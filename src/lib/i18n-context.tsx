import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { detectBrowserLang, isRtl, isSupportedLang, translator, type LangCode } from "./i18n";

const STORAGE_KEY = "niza.lang";

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string) => string;
  rtl: boolean;
};

const LanguageContext = createContext<Ctx | null>(null);

export function readStoredLang(): LangCode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLang(v) ? v : null;
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Start with "en" on both server and first client render to avoid hydration
  // mismatches, then adopt the stored/browser language after mount.
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const initial = readStoredLang() ?? detectBrowserLang();
    if (initial !== "en") setLangState(initial);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: translator(lang), rtl: isRtl(lang) }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  // Safe fallback so components work outside the provider (e.g. isolated tests).
  return { lang: "en", setLang: () => {}, t: translator("en"), rtl: false };
}

export function useT() {
  return useLanguage().t;
}
