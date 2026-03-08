"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export default function Home() {
  const { t, lang, setLang } = useLang();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-sm w-full space-y-10">
        <div className="space-y-2 text-center">
          <div className="flex justify-center relative">
            <div className="relative w-16 h-16">
              <Image src="/logo-brand-cropped.png" alt="Inner Tools" fill style={{ objectFit: "contain" }} className="[filter:sepia(1)_saturate(2.5)_hue-rotate(350deg)_brightness(1.35)]" />
            </div>
            <button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors px-2 py-1 rounded-md border border-border/40 hover:border-border"
            >
              {t.langToggle}
            </button>
          </div>
          <h1 className="text-2xl font-medium tracking-tight">Inner Tools</h1>
          <p className="text-sm text-muted-foreground">{t.home.subtitle}</p>
        </div>

        {/* Quote */}
        <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3 italic">
          {t.home.quote}
          <br />
          <span className="not-italic">{t.home.quoteAuthor}</span>
        </p>

        {/* Method intro */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-base font-medium">{t.home.methodTitle}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t.home.methodDesc}
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2.5">
              <span className="text-primary/60 shrink-0">1.</span>
              <span>{t.home.step1}</span>
            </div>
            <div className="flex gap-2.5">
              <span className="text-primary/60 shrink-0">2.</span>
              <span>{t.home.step2}</span>
            </div>
            <div className="flex gap-2.5">
              <span className="text-primary/60 shrink-0">3.</span>
              <span>{t.home.step3}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3">
            {t.home.wantNote}
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/release/session" className="block">
            <Button className="w-full" size="lg">
              {t.home.startBtn}
            </Button>
          </Link>
          <Link href="/release/history" className="block">
            <Button variant="outline" className="w-full">
              {t.home.historyBtn}
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/50 text-center leading-relaxed">
          {t.home.privacy}
        </p>

        <p className="text-xs text-muted-foreground text-center">{t.home.tarot}</p>
      </div>
    </div>
  );
}
