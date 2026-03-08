"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export default function EnterPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useLang();

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
          <p className="text-sm text-muted-foreground">{t.enter.subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder={t.enter.placeholder}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {error && (
            <p className="text-xs text-destructive">{t.enter.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
            {loading ? t.enter.loading : t.enter.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
