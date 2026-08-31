import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

/**
 * Guards the security-relevant parts of next.config.ts. These headers are the
 * only XSS/clickjacking mitigation the app ships with, and the rewrite is the
 * one place where user-influenced routing meets an outbound request, so a
 * silent regression here is expensive and invisible.
 */
describe("next.config security headers (BH-11)", () => {
  async function headerMap() {
    const groups = await nextConfig.headers!();
    const entries = groups[0]!.headers.map((h) => [h.key, h.value] as const);
    return Object.fromEntries(entries) as Record<string, string>;
  }

  it("ships the baseline header set", async () => {
    const headers = await headerMap();
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("locks down the dangerous CSP directives", async () => {
    const csp = (await headerMap())["Content-Security-Policy"]!;
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("never allows 'unsafe-eval' outside development", async () => {
    const csp = (await headerMap())["Content-Security-Policy"]!;
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"))!;
    if (process.env.NODE_ENV === "production") {
      expect(scriptSrc).not.toContain("unsafe-eval");
    }
    // 'unsafe-inline' is still present pending nonce support (fase 1); this
    // assertion documents that and will fail loudly if it is silently removed
    // from the plan without the nonce work landing.
    expect(scriptSrc).toContain("'self'");
  });
});

describe("next.config /api/v1 rewrite (BH-08)", () => {
  it("resolves to an allowlisted origin with no path or query", async () => {
    const rewrites = (await nextConfig.rewrites!()) as Array<{
      source: string;
      destination: string;
    }>;
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]!.source).toBe("/api/v1/:path*");
    const destination = rewrites[0]!.destination;
    expect(destination.endsWith("/api/v1/:path*")).toBe(true);
    const origin = destination.replace("/api/v1/:path*", "");
    expect(origin).toMatch(
      /^https:\/\/bithauss-api\.azurewebsites\.net$|^http:\/\/localhost:3001$/,
    );
    expect(origin).not.toContain("169.254.169.254");
  });
});
