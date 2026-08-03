import { NextResponse } from "next/server";
import { searchColonias } from "@/lib/sepomex-server";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  GET /api/localidades/colonias?estado=&municipio=&q=&limit=         */
/*                                                                     */
/*  Colonia catalog search. Scoped to a state (and optionally a        */
/*  municipio) it feeds the estado -> municipio -> colonia chain of    */
/*  the property form. Without a state it performs a country-wide      */
/*  search (min. 3 characters) that returns one entry per             */
/*  colonia+municipio+estado, so the UI can disambiguate names such    */
/*  as "Polanco" that exist in several cities.                         */
/* ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const estado = (searchParams.get("estado") ?? "").trim();
  const municipio = (searchParams.get("municipio") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20;

  if (!estado && q.length < 3) {
    return NextResponse.json(
      { colonias: [], hint: "Escribe al menos 3 letras o elige un estado." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const colonias = await searchColonias({ estado, municipio, q, limit });

  return NextResponse.json(
    { colonias },
    {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
