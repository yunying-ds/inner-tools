"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function EnterPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(false);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setError(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-xs w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-medium">Inner Tools</h1>
          <p className="text-sm text-muted-foreground">输入邀请码进入</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="邀请码"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {error && (
            <p className="text-xs text-destructive">邀请码不正确，请再试一次</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
            {loading ? "验证中…" : "进入"}
          </Button>
        </form>
      </div>
    </div>
  );
}
