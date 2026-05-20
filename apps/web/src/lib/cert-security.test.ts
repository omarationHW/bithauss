import { describe, it, expect } from "vitest";
import {
  luhnChecksum,
  seededRandom,
  seedFromHash,
  encodeFolioToZeroWidth,
  buildStegoWatermarkSvg,
  buildSignablePayload,
  base64UrlEncode,
  buildQrUrl,
  sha256,
  computeSecurity,
  type CertData,
} from "./cert-security";

const fixture: CertData = {
  serie: "BRC-ABC",
  folio: "000123",
  direccion: "Av. Reforma 222, Cuauhtémoc, CDMX",
  escritura: "50,000",
  folioReal: "9876",
  supTerreno: "120",
  supConstruida: "85",
  lugar: "Ciudad de México",
  dia: "5",
  mes: "marzo",
  anio: "26",
  numCert: "BRC-2026-000123",
};

describe("luhnChecksum", () => {
  it("returns a single digit between 0 and 9", () => {
    const c = luhnChecksum("BRC000123ABC");
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(9);
  });

  it("is deterministic for the same input", () => {
    expect(luhnChecksum("BRC-2026-000123")).toBe(luhnChecksum("BRC-2026-000123"));
  });

  it("ignores non-alphanumeric chars", () => {
    expect(luhnChecksum("AAA-000-1")).toBe(luhnChecksum("AAA0001"));
  });

  it("changes when input changes", () => {
    expect(luhnChecksum("BRC000123")).not.toBe(luhnChecksum("BRC000124"));
  });
});

describe("seededRandom", () => {
  it("returns the same sequence for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("returns values in [0,1)", () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("returns a different sequence for a different seed", () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect(a()).not.toBe(b());
  });
});

describe("seedFromHash", () => {
  it("extracts a positive integer from the first 8 hex chars", () => {
    expect(seedFromHash("deadbeef1234")).toBe(0xdeadbeef);
  });

  it("falls back to 1 when the prefix isn't hex", () => {
    expect(seedFromHash("zzzz" /* invalid */)).toBe(1);
  });
});

describe("encodeFolioToZeroWidth", () => {
  it("produces a string composed only of zero-width chars + BOM", () => {
    const out = encodeFolioToZeroWidth("AB");
    // Each byte = 8 bits, 2 chars = 16 zero-width chars + 1 BOM
    expect(out.length).toBe(17);
    for (const ch of out) {
      expect(["​", "‌", "﻿"]).toContain(ch);
    }
  });

  it("is deterministic", () => {
    expect(encodeFolioToZeroWidth("000123-7")).toBe(encodeFolioToZeroWidth("000123-7"));
  });
});

describe("buildStegoWatermarkSvg", () => {
  it("returns 60 circles deterministically positioned from the seed", () => {
    const a = buildStegoWatermarkSvg(123);
    const b = buildStegoWatermarkSvg(123);
    expect(a).toBe(b);
    expect((a.match(/<circle /g) || []).length).toBe(60);
  });

  it("produces different output for different seeds", () => {
    expect(buildStegoWatermarkSvg(1)).not.toBe(buildStegoWatermarkSvg(2));
  });
});

describe("base64UrlEncode", () => {
  it("encodes without padding and url-safe", () => {
    const encoded = base64UrlEncode('{"a":1}');
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("buildSignablePayload + buildQrUrl", () => {
  it("includes folio-checksum, serie, hash prefix, iat and verify URL", () => {
    const hash = "a".repeat(64);
    const ts = "2026-05-19T12:00:00.000Z";
    const payload = buildSignablePayload(fixture, hash, 7, ts);
    expect(payload.folio).toBe("000123-7");
    expect(payload.serie).toBe("BRC-ABC");
    expect(payload.hash).toBe("a".repeat(32));
    expect(payload.iat).toBe(ts);
    expect(payload.verify).toContain("/verify/000123");
  });

  it("builds a verify URL with the encoded payload as ?p=", () => {
    const url = buildQrUrl(buildSignablePayload(fixture, "f".repeat(64), 0, "2026-05-19T00:00:00.000Z"));
    expect(url).toMatch(/^https:\/\/bithauss\.com\/verify\?p=[A-Za-z0-9\-_]+$/);
  });
});

describe("sha256 (Web Crypto)", () => {
  it("computes a 64-char hex digest", async () => {
    const h = await sha256("hello");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is stable for the same input", async () => {
    expect(await sha256("brc")).toBe(await sha256("brc"));
  });

  it("changes when input changes", async () => {
    expect(await sha256("brc-a")).not.toBe(await sha256("brc-b"));
  });
});

describe("computeSecurity", () => {
  it("returns the full bundle with consistent fields", async () => {
    const s = await computeSecurity(fixture);
    expect(s.hash).toHaveLength(64);
    expect(s.checksum).toBeGreaterThanOrEqual(0);
    expect(s.checksum).toBeLessThanOrEqual(9);
    expect(new Date(s.timestamp).toString()).not.toBe("Invalid Date");
    expect(s.payload.folio).toBe(`${fixture.folio}-${s.checksum}`);
    expect(s.encodedPayload).toContain("https://bithauss.com/verify?p=");
  });
});
