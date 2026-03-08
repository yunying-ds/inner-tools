"use client";

import { useState, useEffect, ReactNode } from "react";
import { LangContext, translations } from "./i18n";
import type { Lang, T } from "./i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang;
    if (saved === "en" || saved === "zh") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("lang", l);
    // Cookie lets middleware know EN users should bypass invite code
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `lang=${l}; path=/; max-age=${maxAge}; samesite=lax`;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] as unknown as T }}>
      {children}
    </LangContext.Provider>
  );
}
