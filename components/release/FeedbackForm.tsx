"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/i18n";

export function FeedbackForm() {
  const { t } = useLang();
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } catch {
      // silent fail
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className="text-sm text-muted-foreground text-center py-2">{t.explore.feedbackThanks}</p>;
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border text-left">
      <p className="text-sm text-foreground/80">{t.explore.feedbackQuestion}</p>
      <Textarea
        placeholder={t.explore.feedbackPlaceholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading || !content.trim()}>
          {loading ? t.explore.feedbackSubmitting : t.explore.feedbackSubmit}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSubmitted(true)}>
          {t.explore.feedbackSkip}
        </Button>
      </div>
    </div>
  );
}
