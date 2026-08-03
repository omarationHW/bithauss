import { NextResponse } from "next/server";
import { listMunicipios } from "@/lib/sepomex-server";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  GET /api/localidades/municipios?estado=Jalisco&q=guad              */
/*                                                                     */
/*  Municipios / alcaldías of a state, straight from the SEPOMEX       */
/*  catalog. Only the requested slice travels to the client — the      */
/*  dataset itself never leaves the server.                            */
/* ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const estado = (searchParams.get("estado") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();

  if (!estado) {
    return NextResponse.json(
      { error: "Falta el parámetro 'estado'." },
      { status: 400 }
    );
  }

  const municipios = await listMunicipios(estado, q);

  return NextResponse.json(
    { estado, municipios },
    {
      // The catalog is static; let the browser and any CDN keep it.
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
