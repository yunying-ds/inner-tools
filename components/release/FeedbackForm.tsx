"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackForm() {
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
      // 静默失败
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className="text-sm text-muted-foreground text-center py-2">谢谢你的反馈 ✦</p>;
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border text-left">
      <p className="text-sm text-foreground/80">对这个工具有什么反馈？</p>
      <Textarea
        placeholder="和你平时处理情绪的方式相比，用这个工具有什么不同？有没有帮助？哪里顺畅、哪里卡住……"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading || !content.trim()}>
          {loading ? "提交中…" : "提交"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSubmitted(true)}>
          跳过
        </Button>
      </div>
    </div>
  );
}
