import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requireSigningKey } from "@/lib/brc-verify-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 20, windowMs: 60_000 } as const;

/** Stable JSON serializer (sorted keys) so the signature is deterministic. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonical).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

function sign(payload: unknown): string {
  return createHmac("sha256", requireSigningKey())
    .update(canonical(payload))
    .digest("hex");
}

type CertStatus = "VIGENTE" | "EXPIRADO" | "REVOCADO" | "NO_ENCONTRADO";

/**
 * BH-09: the public answer is deliberately the minimum a third party needs to
 * believe the certificate: is it real, is it current, who issued it, and which
 * property (city/state, never the street). `address_line`, `price` and
 * `owner_id` used to travel to anyone holding the share link — for a
 * high-value property that combination is exactly the dataset used to plan a
 * targeted robbery, and under LFPDPPP it is a disclosure with no declared
 * purpose. Those fields now require an authenticated participant.
 */
interface PublicProperty {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
}

interface PrivilegedProperty extends PublicProperty {
  address_line: string | null;
  price: number;
  currency: string;
  featured_image_url: string | null;
  owner_id: string | null;
}

interface VerifyResponse {
  valid: boolean;
  status: CertStatus;
  reason?: string;
  /** "publica" | "participante" — tells the client which fields it may expect. */
  scope: "publica" | "participante";
  certificate?: {
    id: string;
    certificate_number: string;
    issued_at: string;
    expires_at: string;
  };
  property?: PublicProperty | PrivilegedProperty;
  notary?: {
    name: string | null;
    number: string | null;
    state: string | null;
  };
  verifiedAt: string;
  verificationId: string;
  signature: string;
}

function notFound(): NextResponse {
  const verifiedAt = new Date().toISOString();
  const verificationId = randomUUID();
  const body = {
    valid: false,
    status: "NO_ENCONTRADO" as CertStatus,
    reason: "El certificado solicitado no existe.",
    scope: "publica" as const,
    verifiedAt,
    verificationId,
  };
  return NextResponse.json({ ...body, signature: sign(body) }, { status: 404 });
}

/**
 * Is the caller a participant of this certificate (owner of the property, the
 * issuing notary, or an admin)? Only they get the full detail set. Failure to
 * resolve a session is not an error — it just means "public".
 */
async function callerIsParticipant(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string | null | undefined,
  issuedBy: string | null | undefined,
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    if (ownerId && user.id === ownerId) return true;
    if (issuedBy && user.id === issuedBy) return true;

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    return role === "ADMIN" || role === "OPERADOR_BRC";
  } catch {
    // No cookie store (unit tests, edge invocation) → treat as anonymous.
    return false;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Fail loudly and early when the deployment is missing its signing key.
  // Doing this before anything else keeps `notFound()` (which signs) safe and
  // stops a configuration bug from being reported as "certificado inexistente".
  try {
    requireSigningKey();
  } catch (err) {
    logError("verify: signing key missing", err);
    return NextResponse.json(
      {
        error:
          "El servicio de verificación no está configurado correctamente. Escríbenos a soporte@bithauss.com.",
      },
      { status: 500 },
    );
  }

  const { id } = await params;
  if (!id) return notFound();

  const ip = clientIp(req);
  const rl = checkRateLimit(`verify:${ip}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RateLimit-Limit": String(RATE_LIMIT.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
        },
      },
    );
  }

  try {
    let supabase;
    try {
      supabase = createAdminClient();
    } catch (initErr) {
      logError("verify: admin client init failed (check SUPABASE_SERVICE_ROLE_KEY)", initErr);
      throw initErr;
    }

    // Note: revoked_at is optional — the column may not exist yet.
    // Try with it first; fall back to a select without it on schema error.
    let cert: {
      id: string;
      certificate_number: string;
      issued_at: string;
      issued_by: string;
      expires_at: string;
      property_id: string;
      revoked_at?: string | null;
    } | null = null;
    let error: unknown = null;

    const primary = await supabase
      .from("brc_certificates")
      .select(
        "id, certificate_number, issued_at, issued_by, expires_at, property_id, revoked_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (primary.error?.code === "42703" /* undefined_column */) {
      const fallback = await supabase
        .from("brc_certificates")
        .select("id, certificate_number, issued_at, issued_by, expires_at, property_id")
        .eq("id", id)
        .maybeSingle();
      cert = fallback.data;
      error = fallback.error;
    } else {
      cert = primary.data;
      error = primary.error;
    }

    if (error) {
      logError("verify: cert fetch failed", { id, error });
    }
    if (!cert) {
      logError("verify: cert not found in DB", { id });
      return notFound();
    }

    const now = Date.now();
    const expired = new Date(cert.expires_at).getTime() < now;
    const revoked = Boolean((cert as { revoked_at?: string | null }).revoked_at);

    let status: CertStatus = "VIGENTE";
    let reason: string | undefined;
    if (revoked) {
      status = "REVOCADO";
      reason = "Este certificado ha sido revocado por BitHauss.";
    } else if (expired) {
      status = "EXPIRADO";
      reason = "El periodo de vigencia de 90 días ha terminado.";
    }

    let rawProperty: {
      id: string;
      title: string;
      address_line: string | null;
      city: string | null;
      state: string | null;
      price: number;
      currency: string;
      featured_image_url: string | null;
      owner_id: string | null;
    } | null = null;
    if (cert.property_id) {
      const { data: p } = await supabase
        .from("properties")
        .select("id, title, address_line, city, state, price, currency, featured_image_url, owner_id")
        .eq("id", cert.property_id)
        .maybeSingle();
      rawProperty = p;
    }

    const privileged = await callerIsParticipant(
      supabase,
      rawProperty?.owner_id,
      cert.issued_by,
    );

    let property: PublicProperty | PrivilegedProperty | undefined;
    if (rawProperty) {
      const base: PublicProperty = {
        id: rawProperty.id,
        title: rawProperty.title,
        city: rawProperty.city,
        state: rawProperty.state,
      };
      property = privileged
        ? {
            ...base,
            address_line: rawProperty.address_line,
            price: rawProperty.price,
            currency: rawProperty.currency,
            featured_image_url: rawProperty.featured_image_url,
            owner_id: rawProperty.owner_id,
          }
        : base;
    }

    let notaryName: string | null = null;
    let notaryNumber: string | null = null;
    let notaryState: string | null = null;
    if (cert.issued_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", cert.issued_by)
        .maybeSingle();
      if (profile) {
        notaryName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null;
      }
      const { data: notary } = await supabase
        .from("notary_profiles")
        .select("notary_number, notary_state")
        .eq("profile_id", cert.issued_by)
        .maybeSingle();
      if (notary) {
        notaryNumber = notary.notary_number;
        notaryState = notary.notary_state;
      }
    }

    const verifiedAt = new Date().toISOString();
    const verificationId = randomUUID();

    const body: Omit<VerifyResponse, "signature"> = {
      valid: status === "VIGENTE",
      status,
      reason,
      scope: privileged ? "participante" : "publica",
      certificate: {
        id: cert.id,
        certificate_number: cert.certificate_number,
        issued_at: cert.issued_at,
        expires_at: cert.expires_at,
      },
      property,
      notary: {
        name: notaryName,
        number: notaryNumber,
        state: notaryState,
      },
      verifiedAt,
      verificationId,
    };

    return NextResponse.json({ ...body, signature: sign(body) });
  } catch (err) {
    logError("verify: unexpected error", err);
    // A missing signing key must not masquerade as "certificate not found":
    // that is exactly how BH-02 stayed invisible in production.
    if (err instanceof Error && err.message.includes("BRC_VERIFY_SECRET")) {
      return NextResponse.json(
        {
          error:
            "El servicio de verificación no está configurado correctamente. Escríbenos a soporte@bithauss.com.",
        },
        { status: 500 },
      );
    }
    return notFound();
  }
}
