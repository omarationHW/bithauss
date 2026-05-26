/**
 * In-memory sliding-window rate limiter, keyed by client identifier (typically IP).
 *
 * Suitable for single-instance Node deployments (e.g. Azure App Service). Bucket
 * state lives in the Node process and resets on redeploy / cold start. If the app
 * is ever scaled horizontally, replace this with a shared store (Redis, etc.).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface Bucket {
  /** Unix-ms timestamps of requests still inside the active window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Evict empty buckets occasionally so the Map doesn't grow unbounded. */
let lastSweep = Date.now();
function maybeSweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const fresh = bucket.hits.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else bucket.hits = fresh;
  }
}

export interface RateLimitOptions {
  /** Max number of requests permitted within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = opts;
  const now = Date.now();
  maybeSweep(now, windowMs);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    const resetAt = oldest + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    resetAt: now + windowMs,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client IP extraction. Falls back to a constant key when nothing
 * useful is on the request (e.g. local tests using `new Request()` directly).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0];
    if (first) return first.trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "unknown";
}

/** Test-only: clear all state. Not exported via index — import directly. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
  lastSweep = Date.now();
}
