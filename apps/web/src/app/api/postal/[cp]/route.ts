import { NextResponse } from "next/server";
import { lookupPostal } from "@/lib/sepomex-server";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  SEPOMEX postal-code API                                            */
/*                                                                     */
/*  Reading + caching of the catalog lives in @/lib/sepomex-server,    */
/*  shared with /api/localidades/*. The dataset stays on the server.   */
/* ------------------------------------------------------------------ */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cp: string }> }
) {
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
