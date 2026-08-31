import { NextResponse } from "next/server";
import { lookupPostal } from "@/lib/sepomex-server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  SEPOMEX postal-code API                                            */
/*                                                                     */
/*  Reading + caching of the catalog lives in @/lib/sepomex-server,    */
/*  shared with /api/localidades/*. The dataset stays on the server.   */
/* ------------------------------------------------------------------ */

// BH-10: the SEPOMEX catalog is a local dataset, but each lookup is a scan
// over it. Without a cap the endpoint is a free CPU sink and lets anyone
// mirror the whole catalog by walking the 100 000 possible codes.
const RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cp: string }> }
) {
  const limited = enforceRateLimit(req, "postal", RATE_LIMIT);
  if (limited) return limited;

  const { cp } = await params;

  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json(
      { error: "El código postal debe tener 5 dígitos." },
      { status: 400 }
    );
  }

  const record = await lookupPostal(cp);

  if (!record) {
    return NextResponse.json(
      { error: "Código postal no encontrado." },
      { status: 404 }
    );
  }

  // CPs don't change; let the browser/CDN cache aggressively.
  return NextResponse.json(record, {
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}
