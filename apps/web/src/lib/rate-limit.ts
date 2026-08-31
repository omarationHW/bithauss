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

const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** Strips a `:port` suffix (Azure appends one) and IPv6 brackets. */
function normalizeIp(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close > 0) value = value.slice(1, close);
  } else if (IPV4.test(value.split(":")[0] ?? "") && value.includes(":")) {
    value = value.split(":")[0] ?? value;
  }
  // Reject anything that is not plausibly an address, so a header full of
  // junk cannot mint unlimited bucket keys.
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return null;
  if (value.length > 45) return null;
  return value.toLowerCase();
}

/**
 * How many proxies sit between the client and this process. Azure App Service
 * appends the caller's address to `X-Forwarded-For`, so the *rightmost* entry
 * is the one the platform wrote and the only one an attacker cannot choose.
 * Behind Azure Front Door there is one more hop — raise this to 2 (env var)
 * when Front Door is in front, per docs/SECURITY.md section 4.3.
 */
function proxyDepth(): number {
  const raw = Number(process.env.RATE_LIMIT_PROXY_DEPTH ?? "1");
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

/**
 * Client identity for rate limiting (BH-10).
 *
 * The previous implementation read `x-forwarded-for` left-to-right, so
 * `curl -H "X-Forwarded-For: 1.2.3.<random>"` produced a fresh bucket on every
 * request and the limiter did nothing at all. Two changes fix that:
 *
 *  1. Prefer headers a client cannot forge because the edge overwrites them
 *     (`x-azure-clientip` from Front Door, `cf-connecting-ip` from Cloudflare).
 *  2. Otherwise take `x-forwarded-for` from the RIGHT, skipping `proxyDepth()-1`
 *     entries — the attacker controls the left of that list, never the right.
 *
 * This is still per-process state (see the module header); the header handling
 * is what stops the trivial bypass, the distributed store is the fase-1 task.
 */
export function clientIp(req: Request): string {
  // Edge-injected headers: these are overwritten by the proxy, so a value the
  // client sent is discarded before it reaches us.
  for (const header of ["x-azure-clientip", "cf-connecting-ip", "true-client-ip"]) {
    const value = req.headers.get(header);
    const ip = value ? normalizeIp(value.split(",")[0] ?? "") : null;
    if (ip) return ip;
  }

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const index = parts.length - proxyDepth();
    const candidate = parts[Math.max(0, index)];
    const ip = candidate ? normalizeIp(candidate) : null;
    if (ip) return ip;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const ip = normalizeIp(realIp);
    if (ip) return ip;
  }

  // Everything unattributable shares one bucket on purpose: an anonymous
  // flood should exhaust a single allowance, not bypass the limiter.
  return "unknown";
}

/** Standard rate-limit headers, so clients can back off intelligently. */
export function rateLimitHeaders(
  result: RateLimitResult,
  opts: RateLimitOptions,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(opts.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

/**
 * One-liner for route handlers: returns a 429 `Response` when the caller is
 * over the limit, or `null` when the request may proceed.
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  opts: RateLimitOptions,
): Response | null {
  const result = checkRateLimit(`${scope}:${clientIp(req)}`, opts);
  if (result.allowed) return null;
  return new Response(
    JSON.stringify({
      error: "Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.",
      retryAfterSeconds: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...rateLimitHeaders(result, opts),
      },
    },
  );
}

/** Test-only: clear all state. Not exported via index — import directly. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
  lastSweep = Date.now();
}
