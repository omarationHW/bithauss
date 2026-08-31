import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assertServerEnv,
  missingServerEnv,
  MissingEnvError,
  REQUIRED_WEB_ENV,
} from "./env";

const complete: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  BRC_VERIFY_SECRET: "a".repeat(64),
};

function withoutKeys(...keys: string[]): Record<string, string> {
  const env = { ...complete };
  for (const key of keys) delete env[key];
  return env;
}

afterEach(() => vi.restoreAllMocks());

describe("assertServerEnv (BH-02)", () => {
  it("passes when every required variable is present", () => {
    expect(() =>
      assertServerEnv({ env: complete, isProduction: true }),
    ).not.toThrow();
  });

  it("fails startup in production when BRC_VERIFY_SECRET is missing", () => {
    const env = withoutKeys("BRC_VERIFY_SECRET");
    expect(() => assertServerEnv({ env, isProduction: true })).toThrow(
      MissingEnvError,
    );
  });

  it("fails startup in production when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    // This is the variable whose absence made every certificate report
    // NO_ENCONTRADO in production without a single error being surfaced.
    const env = withoutKeys("SUPABASE_SERVICE_ROLE_KEY");
    expect(() => assertServerEnv({ env, isProduction: true })).toThrow(
      MissingEnvError,
    );
  });

  it("lists every missing variable at once, with a reason", () => {
    try {
      assertServerEnv({ env: {}, isProduction: true });
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      for (const req of REQUIRED_WEB_ENV) {
        expect(message).toContain(req.name);
        expect(message).toContain(req.why);
      }
      expect(message).toMatch(/docs\/SECURITY\.md/);
    }
  });

  it("treats a blank value as missing", () => {
    expect(() =>
      assertServerEnv({ env: { ...complete, BRC_VERIFY_SECRET: "   " }, isProduction: true }),
    ).toThrow(MissingEnvError);
  });

  it("warns instead of throwing outside production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = assertServerEnv({ env: {}, isProduction: false });
    expect(missing.length).toBe(REQUIRED_WEB_ENV.length);
    expect(warn).toHaveBeenCalled();
  });

  it("reports exactly which variables are absent", () => {
    const env = withoutKeys("BRC_VERIFY_SECRET", "SUPABASE_SERVICE_ROLE_KEY");
    expect(missingServerEnv(env).map((m) => m.name)).toEqual([
      "SUPABASE_SERVICE_ROLE_KEY",
      "BRC_VERIFY_SECRET",
    ]);
  });
});
