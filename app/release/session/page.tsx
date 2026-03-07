"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const QuickSession = dynamic(() => import("./session-client"), { ssr: false });
const ExploreSession = dynamic(() => import("./session-client-v1"), { ssr: false });

type Mode = "quick" | "explore";

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode === "quick") return <QuickSession />;
  if (mode === "explore") return <ExploreSession onBack={() => setMode(null)} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <button onClick={() => router.push("/")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← 返回
        </button>
        <span className="text-xs text-muted-foreground">圣多纳释放法</span>
        <span className="w-8" />
      </div>

      <div className="flex-1 flex items-start justify-center px-6 pt-10">
        <div className="max-w-lg w-full space-y-8 step-animate">
          <div className="space-y-2">
            <h2 className="text-xl font-medium">选择模式</h2>
            <p className="text-sm text-muted-foreground">根据你现在的状态选择适合的方式。</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode("quick")}
              className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200 space-y-1.5"
            >
              <p className="font-medium">快速模式</p>
              <p className="text-xs text-muted-foreground leading-relaxed">适合有释放经验的人，节奏简洁高效。</p>
            </button>

            <button
              onClick={() => setMode("explore")}
              className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200 space-y-1.5"
            >
              <p className="font-medium">探索模式</p>
              <p className="text-xs text-muted-foreground leading-relaxed">适合新手或时间充裕时，引导更细致完整。</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
