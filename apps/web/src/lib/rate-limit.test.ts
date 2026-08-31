import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  clientIp,
  enforceRateLimit,
  __resetRateLimitForTests,
} from "./rate-limit";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/thing", { headers });
}

beforeEach(() => __resetRateLimitForTests());
afterEach(() => {
  delete process.env.RATE_LIMIT_PROXY_DEPTH;
});

describe("clientIp (BH-10)", () => {
  it("ignores a spoofed X-Forwarded-For prefix and takes the proxy-written entry", () => {
    // The old implementation read left-to-right, so `curl -H "X-Forwarded-For:
    // <random>"` minted a fresh bucket per request and the limiter did nothing.
    // Azure appends the real caller to the right of the list.
    const a = clientIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }));
    const b = clientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.9" }));
    expect(a).toBe("203.0.113.9");
    expect(a).toBe(b);
  });

  it("prefers edge headers the client cannot forge", () => {
    expect(
      clientIp(
        req({
          "x-azure-clientip": "198.51.100.7",
          "x-forwarded-for": "1.2.3.4",
        }),
      ),
    ).toBe("198.51.100.7");
  });

  it("honours a deeper proxy chain when configured", () => {
    process.env.RATE_LIMIT_PROXY_DEPTH = "2";
    expect(
      clientIp(req({ "x-forwarded-for": "1.1.1.1, 203.0.113.9, 10.0.0.1" })),
    ).toBe("203.0.113.9");
  });

  it("strips the port Azure appends", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9:52344" }))).toBe(
      "203.0.113.9",
    );
  });

  it("rejects junk instead of minting a bucket key from it", () => {
    expect(clientIp(req({ "x-forwarded-for": "<script>alert(1)</script>" }))).toBe(
      "unknown",
    );
    expect(clientIp(req({ "x-forwarded-for": "a".repeat(200) }))).toBe("unknown");
  });

  it("funnels unattributable traffic into a single shared bucket", () => {
    expect(clientIp(req())).toBe("unknown");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });
});

describe("checkRateLimit", () => {
  it("allows up to the limit and then denies with a retry hint", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", opts).allowed).toBe(true);
    }
    const denied = checkRateLimit("k", opts);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys buckets independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("a", opts).allowed).toBe(true);
    expect(checkRateLimit("b", opts).allowed).toBe(true);
    expect(checkRateLimit("a", opts).allowed).toBe(false);
  });
});

describe("enforceRateLimit", () => {
  const opts = { limit: 2, windowMs: 60_000 };
  const from = () => req({ "x-forwarded-for": "203.0.113.44" });

  it("returns null while under the limit", () => {
    expect(enforceRateLimit(from(), "geocode", opts)).toBeNull();
    expect(enforceRateLimit(from(), "geocode", opts)).toBeNull();
  });

  it("returns a 429 with Retry-After once exceeded", async () => {
    enforceRateLimit(from(), "geocode", opts);
    enforceRateLimit(from(), "geocode", opts);
    const res = enforceRateLimit(from(), "geocode", opts);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(res!.headers.get("X-RateLimit-Limit")).toBe("2");
    const body = (await res!.json()) as { error: string };
    // Actionable Spanish, not "Too Many Requests".
    expect(body.error).toMatch(/Demasiadas solicitudes/);
  });

  it("keeps scopes independent so one endpoint cannot starve another", () => {
    enforceRateLimit(from(), "geocode", opts);
    enforceRateLimit(from(), "geocode", opts);
    expect(enforceRateLimit(from(), "geocode", opts)).not.toBeNull();
    expect(enforceRateLimit(from(), "ticker", opts)).toBeNull();
  });
});
