import { describe, it, expect } from "vitest";
import { scrubSentryEvent, scrubValue, REDACTED } from "./sentry-scrub";

describe("scrubSentryEvent (BH-17)", () => {
  it("drops the request body, cookies and env wholesale", () => {
    const event = scrubSentryEvent({
      request: {
        data: { curp: "ABCD010101HDFXXX01", escritura: "texto completo" },
        cookies: { "sb-access-token": "ey..." },
        env: { SUPABASE_SERVICE_ROLE_KEY: "secret" },
      },
    });
    expect(event?.request?.data).toBeUndefined();
    expect(event?.request?.cookies).toBeUndefined();
    expect(event?.request?.env).toBeUndefined();
  });

  it("redacts sensitive headers and keeps harmless ones", () => {
    const event = scrubSentryEvent({
      request: {
        headers: { authorization: "Bearer ey...", "user-agent": "Mozilla/5.0" },
      },
    });
    expect(event?.request?.headers?.authorization).toBe(REDACTED);
    expect(event?.request?.headers?.["user-agent"]).toBe("Mozilla/5.0");
  });

  it("strips the query string", () => {
    const event = scrubSentryEvent({
      request: { url: "https://bithauss.com/certificado/1?token=abc" },
    });
    expect(event?.request?.url).toBe(`https://bithauss.com/certificado/1?${REDACTED}`);
  });

  it("keeps only the user id", () => {
    const event = scrubSentryEvent({ user: { id: "u", email: "a@b.com" } });
    expect(event?.user).toEqual({ id: "u" });
  });

  it.each(["curp", "rfc", "escritura", "folio_real", "address_line", "email", "password"])(
    "redacts nested key %s",
    (key) => {
      const scrubbed = scrubValue({ deep: { [key]: "x" } }) as {
        deep: Record<string, unknown>;
      };
      expect(scrubbed.deep[key]).toBe(REDACTED);
    },
  );

  it("leaves ordinary diagnostics alone", () => {
    expect(scrubValue({ statusCode: 500 })).toEqual({ statusCode: 500 });
  });
});
