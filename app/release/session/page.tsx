"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

const QuickSession = dynamic(() => import("./session-client"), { ssr: false });
const ExploreSession = dynamic(() => import("./session-client-v1"), { ssr: false });

type Mode = "quick" | "explore";

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const { t } = useLang();

  if (mode === "quick") return <QuickSession onBack={() => setMode(null)} />;
  if (mode === "explore") return <ExploreSession onBack={() => setMode(null)} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <button onClick={() => router.push("/")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {t.modeSelect.back}
        </button>
        <span className="text-xs text-muted-foreground">{t.modeSelect.title}</span>
        <span className="w-8" />
      </div>

      <div className="flex-1 flex items-start justify-center px-6 pt-10">
        <div className="max-w-lg w-full space-y-8 step-animate">
          <div className="space-y-2">
            <h2 className="text-xl font-medium">{t.modeSelect.heading}</h2>
            <p className="text-sm text-muted-foreground">{t.modeSelect.subtitle}</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode("quick")}
              className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200 space-y-1.5"
            >
              <p className="font-medium">{t.modeSelect.quickTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.modeSelect.quickDesc}</p>
            </button>

            <button
              onClick={() => setMode("explore")}
              className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200 space-y-1.5"
            >
              <p className="font-medium">{t.modeSelect.exploreTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.modeSelect.exploreDesc}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
