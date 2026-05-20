import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client BEFORE importing the route.
const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
}));

// HMAC secret must be deterministic for the test
process.env.BRC_VERIFY_SECRET = "test-secret-do-not-use-in-prod";

import { GET } from "./route";

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
  certificate?: { certificate_number: string };
  property?: { id: string; title: string };
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
});
