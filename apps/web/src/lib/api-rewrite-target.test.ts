import { describe, it, expect } from "vitest";
import {
  resolveApiRewriteTarget,
  InvalidRewriteTargetError,
  DEFAULT_API_HOST,
} from "./api-rewrite-target";

const prod = { isProduction: true };
const dev = { isProduction: false };

describe("api rewrite target (BH-08)", () => {
  it("accepts the production API host", () => {
    expect(
      resolveApiRewriteTarget({ ...prod, apiUrl: `https://${DEFAULT_API_HOST}` }),
    ).toBe(`https://${DEFAULT_API_HOST}`);
  });

  it("falls back to the production host when API_URL is unset", () => {
    expect(resolveApiRewriteTarget(prod)).toBe(`https://${DEFAULT_API_HOST}`);
    expect(resolveApiRewriteTarget(dev)).toBe("http://localhost:3001");
  });

  it("refuses the cloud metadata endpoint", () => {
    // This is the destination that turns the Next rewrite SSRF into a
    // managed-identity token leak on Azure App Service.
    expect(() =>
      resolveApiRewriteTarget({ ...prod, apiUrl: "https://169.254.169.254" }),
    ).toThrow(InvalidRewriteTargetError);
    expect(() =>
      resolveApiRewriteTarget({
        ...prod,
        apiUrl: "https://metadata.google.internal",
        extraHosts: "metadata.google.internal",
      }),
    ).toThrow(/metadatos/i);
  });

  it("refuses private and loopback addresses in production", () => {
    for (const host of ["10.0.0.5", "172.16.0.1", "192.168.1.1", "127.0.0.1", "localhost"]) {
      expect(() =>
        resolveApiRewriteTarget({ ...prod, apiUrl: `https://${host}`, extraHosts: host }),
      ).toThrow(InvalidRewriteTargetError);
    }
  });

  it("refuses a host that is not on the allowlist", () => {
    expect(() =>
      resolveApiRewriteTarget({ ...prod, apiUrl: "https://evil.example.com" }),
    ).toThrow(/allowlist/i);
  });

  it("honours an explicit extra host", () => {
    expect(
      resolveApiRewriteTarget({
        ...prod,
        apiUrl: "https://api-staging.bithauss.com",
        extraHosts: "api-staging.bithauss.com",
      }),
    ).toBe("https://api-staging.bithauss.com");
  });

  it("refuses http in production", () => {
    expect(() =>
      resolveApiRewriteTarget({ ...prod, apiUrl: `http://${DEFAULT_API_HOST}` }),
    ).toThrow(/https/i);
  });

  it("refuses credentials, paths, queries and fragments", () => {
    const cases = [
      `https://user:pass@${DEFAULT_API_HOST}`,
      `https://${DEFAULT_API_HOST}/internal`,
      `https://${DEFAULT_API_HOST}?x=1`,
      `https://${DEFAULT_API_HOST}#frag`,
    ];
    for (const apiUrl of cases) {
      expect(() => resolveApiRewriteTarget({ ...prod, apiUrl })).toThrow(
        InvalidRewriteTargetError,
      );
    }
  });

  it("refuses garbage that is not an absolute URL", () => {
    for (const apiUrl of ["not-a-url", "/relative", "javascript:alert(1)"]) {
      expect(() => resolveApiRewriteTarget({ ...prod, apiUrl })).toThrow(
        InvalidRewriteTargetError,
      );
    }
  });

  it("allows localhost only outside production", () => {
    expect(resolveApiRewriteTarget({ ...dev, apiUrl: "http://localhost:3001" })).toBe(
      "http://localhost:3001",
    );
  });
});
