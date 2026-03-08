"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SavedSession } from "@/types/release";
import { useLang } from "@/lib/i18n";

export default function HistoryPage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(t.history.dateLocale, {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getEmotionLabel(s: SavedSession): string {
    if (s.identifiedEmotion) {
      return lang === "en"
        ? (s.identifiedEmotion.levelEn ?? s.identifiedEmotion.level)
        : s.identifiedEmotion.level;
    }
    return s.bodyFeeling ? t.history.bodySensation : t.history.unknown;
  }

  function getDisplaySummary(s: SavedSession): string {
    if (lang === "en" && s.identifiedEmotion) {
      const level = s.identifiedEmotion.levelEn ?? s.identifiedEmotion.level;
      const words = (s.identifiedEmotion.wordsEn ?? s.identifiedEmotion.wordsCn ?? s.identifiedEmotion.words).join(", ");
      return s.status === "abandoned"
        ? `Abandoned release of ${words}`
        : `Processed ${level} (${words})`;
    }
    return s.summary;
  }

  function handleDelete(id: string) {
    const updated = history.filter((s) => s.id !== id);
    setHistory(updated);
    localStorage.setItem("release_history", JSON.stringify(updated));
    setConfirmDeleteId(null);
  }

  useEffect(() => {
    const stored = localStorage.getItem("release_history");
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">{t.history.title}</h1>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            {t.history.back}
          </Button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            {t.history.empty}
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
                      {getEmotionLabel(s)}
                    </span>
                    {s.status === "abandoned" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.history.abandoned}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatDate(s.startedAt)}</span>
                    {confirmDeleteId === s.id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <button onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive/80 transition-colors">{t.history.confirmDelete}</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">{t.history.cancelDelete}</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(s.id)}
                        className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                      >
                        {t.history.del}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{getDisplaySummary(s)}</p>
                {s.exitReason && (
                  <p className="text-xs text-muted-foreground/70">{s.exitReason}</p>
                )}
                {s.exitNotes && (
                  <p className="text-xs text-foreground/60 leading-relaxed border-l-2 border-border pl-3 mt-1">{s.exitNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={() => router.push("/release/session")}>
          {t.history.startNew}
        </Button>
      </div>
    </div>
  );
}
