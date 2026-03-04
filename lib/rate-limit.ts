// Simple in-memory sliding window rate limiter.
// Works within a single serverless instance; sufficient for small-scale internal use.

const requests = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 15;  // per IP per window

export function checkRateLimit(ip: string): { ok: boolean } {
  const now = Date.now();
  const timestamps = (requests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    requests.set(ip, timestamps);
    return { ok: false };
  }

  timestamps.push(now);
  requests.set(ip, timestamps);
  return { ok: true };
}
