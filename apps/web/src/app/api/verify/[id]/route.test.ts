import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client BEFORE importing the route.
const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
}));

// The route asks for the caller's session to decide whether it may return the
// full detail set. Anonymous by default — that is the public path we care about.
const getUserMock = vi.fn().mockResolvedValue({ data: { user: null } });
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

// HMAC secret must be deterministic for the test
process.env.BRC_VERIFY_SECRET = "test-secret-do-not-use-in-prod";

import { GET } from "./route";
import { requireSigningKey } from "@/lib/brc-verify-secret";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

const CERT_ID = "00000000-0000-0000-0000-000000000001";
const PROP_ID = "00000000-0000-0000-0000-000000000002";
const NOTARY_ID = "00000000-0000-0000-0000-000000000003";

const yearFromNow = new Date(Date.now() + 365 * 86_400_000).toISOString();
const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();

function chain(result: { data: unknown; error?: unknown }) {
  // Build a thenable-like chain that ignores .select/.eq/.maybeSingle and
  // returns the canned result at the end.
  const finalResult = { data: result.data, error: result.error ?? null };
  const obj: Record<string, unknown> = {};
  obj.select = () => obj;
  obj.eq = () => obj;
  obj.maybeSingle = () => Promise.resolve(finalResult);
  return obj;
}

interface VerifyResponseBody {
  valid: boolean;
  status: "VIGENTE" | "EXPIRADO" | "REVOCADO" | "NO_ENCONTRADO";
  reason?: string;
  scope: "publica" | "participante";
  certificate?: { certificate_number: string };
  property?: {
    id: string;
    title: string;
    city: string | null;
    state: string | null;
    address_line?: string | null;
    price?: number;
    owner_id?: string | null;
  };
  notary?: { name: string | null; number: string | null; state: string | null };
  signature: string;
  verifiedAt: string;
  verificationId: string;
}

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildRequest(): Request {
  return new Request(`http://localhost/api/verify/${CERT_ID}`);
}

function setupCert(overrides: Record<string, unknown> = {}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "brc_certificates") {
      return chain({
        data: {
          id: CERT_ID,
          certificate_number: "BRC-2026-000001",
          issued_at: yearAgo,
          issued_by: NOTARY_ID,
          expires_at: yearFromNow,
          property_id: PROP_ID,
          revoked_at: null,
          ...overrides,
        },
      });
    }
    if (table === "properties") {
      return chain({
        data: {
          id: PROP_ID,
          title: "Casa de Prueba",
          address_line: "Av. Test 1",
          city: "CDMX",
          state: "Ciudad de Mexico",
          price: 5_000_000,
          currency: "MXN",
          featured_image_url: null,
          owner_id: "owner-xyz",
        },
      });
    }
    if (table === "profiles") {
      return chain({ data: { first_name: "Jesus", last_name: "Valdez" } });
    }
    if (table === "notary_profiles") {
      return chain({ data: { notary_number: "22", notary_state: "Ciudad de México" } });
    }
    return chain({ data: null });
  });
}

beforeEach(() => {
  fromMock.mockReset();
  __resetRateLimitForTests();
  getUserMock.mockResolvedValue({ data: { user: null } });
  process.env.BRC_VERIFY_SECRET = "test-secret-do-not-use-in-prod";
});

describe("GET /api/verify/[id]", () => {
  it("returns VIGENTE with full payload + signature when cert is active", async () => {
    setupCert();
    const res = await GET(buildRequest(), buildParams(CERT_ID));
    const body = (await res.json()) as VerifyResponseBody;
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.status).toBe("VIGENTE");
    expect(body.certificate?.certificate_number).toBe("BRC-2026-000001");
    expect(body.property?.title).toBe("Casa de Prueba");
    expect(body.scope).toBe("publica");
    expect(body.notary?.name).toBe("Jesus Valdez");
    expect(body.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(body.verificationId).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    );
  });

  it("returns EXPIRADO when expires_at is in the past", async () => {
    setupCert({ expires_at: yearAgo });
    const res = await GET(buildRequest(), buildParams(CERT_ID));
    const body = (await res.json()) as VerifyResponseBody;
    expect(res.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.status).toBe("EXPIRADO");
    expect(body.reason).toMatch(/vigencia/i);
  });

  it("returns REVOCADO when revoked_at is set", async () => {
    setupCert({ revoked_at: yearAgo });
    const res = await GET(buildRequest(), buildParams(CERT_ID));
    const body = (await res.json()) as VerifyResponseBody;
    expect(body.valid).toBe(false);
    expect(body.status).toBe("REVOCADO");
  });

  it("returns NO_ENCONTRADO with 404 when cert row is missing", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "brc_certificates") return chain({ data: null });
      return chain({ data: null });
    });
    const res = await GET(buildRequest(), buildParams(CERT_ID));
    const body = (await res.json()) as VerifyResponseBody;
    expect(res.status).toBe(404);
    expect(body.valid).toBe(false);
    expect(body.status).toBe("NO_ENCONTRADO");
    expect(body.signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("emits a different signature on each call (verificationId changes)", async () => {
    setupCert();
    const r1 = (await (await GET(buildRequest(), buildParams(CERT_ID))).json()) as VerifyResponseBody;
    setupCert();
    const r2 = (await (await GET(buildRequest(), buildParams(CERT_ID))).json()) as VerifyResponseBody;
    expect(r1.verificationId).not.toBe(r2.verificationId);
    expect(r1.signature).not.toBe(r2.signature);
  });

  it("returns 429 with Retry-After once the per-IP limit is exceeded", async () => {
    setupCert();
    // Distinct IP so this test doesn't share state with the others.
    const reqFromIp = () =>
      new Request(`http://localhost/api/verify/${CERT_ID}`, {
        headers: { "x-forwarded-for": "203.0.113.10" },
      });

    // Limit is 20 req/min — exhaust it.
    for (let i = 0; i < 20; i++) {
      const res = await GET(reqFromIp(), buildParams(CERT_ID));
      expect(res.status).toBe(200);
    }

    const limited = await GET(reqFromIp(), buildParams(CERT_ID));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(limited.headers.get("X-RateLimit-Limit")).toBe("20");
  });
});

/* ------------------------------------------------------------------ */
/*  BH-09 — the public answer must not carry PII                       */
/* ------------------------------------------------------------------ */

describe("GET /api/verify/[id] · public payload (BH-09)", () => {
  it("omits address, price and owner_id for an anonymous caller", async () => {
    setupCert();
    const body = (await (
      await GET(buildRequest(), buildParams(CERT_ID))
    ).json()) as VerifyResponseBody;

    // Everything a third party legitimately needs stays.
    expect(body.property?.city).toBe("CDMX");
    expect(body.property?.state).toBe("Ciudad de Mexico");
    expect(body.property?.title).toBe("Casa de Prueba");

    // The share link is meant to be forwarded by WhatsApp. Street address +
    // price + the owner's auth UUID is the dataset used to plan a targeted
    // robbery, and it has no bearing on whether the certificate is valid.
    expect(body.property).not.toHaveProperty("address_line");
    expect(body.property).not.toHaveProperty("price");
    expect(body.property).not.toHaveProperty("owner_id");
    expect(JSON.stringify(body)).not.toContain("Av. Test 1");
    expect(JSON.stringify(body)).not.toContain("owner-xyz");
  });

  it("returns the full detail set to the property owner", async () => {
    setupCert();
    getUserMock.mockResolvedValue({ data: { user: { id: "owner-xyz" } } });
    const body = (await (
      await GET(buildRequest(), buildParams(CERT_ID))
    ).json()) as VerifyResponseBody;

    expect(body.scope).toBe("participante");
    expect(body.property?.address_line).toBe("Av. Test 1");
    expect(body.property?.owner_id).toBe("owner-xyz");
  });

  it("returns the full detail set to the issuing notary", async () => {
    setupCert();
    getUserMock.mockResolvedValue({ data: { user: { id: NOTARY_ID } } });
    const body = (await (
      await GET(buildRequest(), buildParams(CERT_ID))
    ).json()) as VerifyResponseBody;
    expect(body.scope).toBe("participante");
  });

  it("does not upgrade an unrelated authenticated user", async () => {
    setupCert();
    getUserMock.mockResolvedValue({
      data: { user: { id: "00000000-0000-0000-0000-0000000000ff" } },
    });
    const body = (await (
      await GET(buildRequest(), buildParams(CERT_ID))
    ).json()) as VerifyResponseBody;
    expect(body.scope).toBe("publica");
    expect(body.property).not.toHaveProperty("price");
  });
});

/* ------------------------------------------------------------------ */
/*  BH-02 — no fallback signing key                                    */
/* ------------------------------------------------------------------ */

describe("BRC_VERIFY_SECRET (BH-02)", () => {
  it("throws instead of falling back to a key committed to the repo", () => {
    delete process.env.BRC_VERIFY_SECRET;
    expect(() => requireSigningKey()).toThrow(/BRC_VERIFY_SECRET/);
    process.env.BRC_VERIFY_SECRET = "   ";
    expect(() => requireSigningKey()).toThrow(/BRC_VERIFY_SECRET/);
  });

  it("never accepts the old hard-coded development value implicitly", () => {
    delete process.env.BRC_VERIFY_SECRET;
    let message = "";
    try {
      requireSigningKey();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).not.toContain("dev-only-brc-verify-secret");
  });

  it("answers 500 (not NO_ENCONTRADO) when the key is absent", async () => {
    setupCert();
    delete process.env.BRC_VERIFY_SECRET;
    const res = await GET(buildRequest(), buildParams(CERT_ID));
    // Reporting a configuration bug as "this certificate does not exist" is
    // exactly how BH-02 stayed invisible in production.
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/no está configurado correctamente/i);
  });
});
