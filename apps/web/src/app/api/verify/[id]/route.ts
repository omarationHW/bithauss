import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNING_KEY =
  process.env.BRC_VERIFY_SECRET ??
  // Dev fallback — DO NOT rely on this in production.
  "dev-only-brc-verify-secret-rotate-in-prod";

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
  return createHmac("sha256", SIGNING_KEY).update(canonical(payload)).digest("hex");
}

type CertStatus = "VIGENTE" | "EXPIRADO" | "REVOCADO" | "NO_ENCONTRADO";

interface VerifyResponse {
  valid: boolean;
  status: CertStatus;
  reason?: string;
  certificate?: {
    id: string;
    certificate_number: string;
    issued_at: string;
    expires_at: string;
  };
  property?: {
    id: string;
    title: string;
    address_line: string | null;
    city: string | null;
    state: string | null;
    price: number;
    currency: string;
    featured_image_url: string | null;
    owner_id: string | null;
  };
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
    verifiedAt,
    verificationId,
  };
  return NextResponse.json({ ...body, signature: sign(body) }, { status: 404 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return notFound();

  try {
    let supabase;
    try {
      supabase = createAdminClient();
    } catch (initErr) {
      logError("verify: admin client init failed (check SUPABASE_SERVICE_ROLE_KEY)", initErr);
      throw initErr;
    }

    const { data: cert, error } = await supabase
      .from("brc_certificates")
      .select(
        "id, certificate_number, issued_at, issued_by, expires_at, property_id, revoked_at",
      )
      .eq("id", id)
      .maybeSingle();

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

    let property = null;
    if (cert.property_id) {
      const { data: p } = await supabase
        .from("properties")
        .select("id, title, address_line, city, state, price, currency, featured_image_url, owner_id")
        .eq("id", cert.property_id)
        .maybeSingle();
      property = p;
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
      certificate: {
        id: cert.id,
        certificate_number: cert.certificate_number,
        issued_at: cert.issued_at,
        expires_at: cert.expires_at,
      },
      property: property
        ? {
            id: property.id,
            title: property.title,
            address_line: property.address_line,
            city: property.city,
            state: property.state,
            price: property.price,
            currency: property.currency,
            featured_image_url: property.featured_image_url,
            owner_id: property.owner_id,
          }
        : undefined,
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
    return notFound();
  }
}
