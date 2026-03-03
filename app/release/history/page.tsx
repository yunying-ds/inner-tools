"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SavedSession } from "@/types/release";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SavedSession[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("release_history");
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">释放记录</h1>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            返回
          </Button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            暂无记录
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((s) => (
              <div
                key={s.id}
                className="border border-border rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {s.identifiedEmotion?.level ?? "未知情绪"}
                    </span>
                    {s.status === "abandoned" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">中止</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(s.startedAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.summary}</p>
                {s.exitReason && (
                  <p className="text-xs text-muted-foreground/70">原因：{s.exitReason}</p>
                )}
                {s.exitNotes && (
                  <p className="text-xs text-foreground/60 leading-relaxed border-l-2 border-border pl-3 mt-1">{s.exitNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={() => router.push("/release/session")}>
          开始新的释放
        </Button>
      </div>
    </div>
  );
}
