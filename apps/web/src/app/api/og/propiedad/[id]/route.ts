import { NextRequest, NextResponse } from "next/server";
import { resolveCleanPhotoUrlServer } from "@/lib/clean-photo";
import {
  OG_IMAGE_SIZE,
  fetchSharedProperty,
} from "@/lib/property-share-metadata";
import { logError } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Imagen de la vista previa del enlace (og:image) de una propiedad publicada.
 *
 * - Usa la foto de portada SIN la marca de agua de la inmobiliaria cuando hay
 *   original archivado (ver lib/clean-photo.ts).
 * - La recorta a 1200x630 y la recomprime en JPEG: las fotos de celular pesan
 *   varios MB y WhatsApp descarta la miniatura cuando pasa de ~300 KB.
 * - Sólo propiedades PUBLICADAS; el resto responde 404 y la vista previa se
 *   queda sin imagen (la metadata ya cae a la genérica en ese caso).
 */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const property = await fetchSharedProperty(id);
  if (!property?.featured_image_url) {
    return new NextResponse(null, { status: 404 });
  }

  const source = await resolveCleanPhotoUrlServer(property.featured_image_url);
  if (!source) return new NextResponse(null, { status: 404 });

  // Sólo hosts propios: la URL viene de la BD, pero esto no debe convertirse
  // en un proxy abierto si alguien guarda una URL arbitraria.
  if (!isAllowedImageHost(source)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const upstream = await fetch(source, { next: { revalidate: 3600 } } as RequestInit);
    if (!upstream.ok) return new NextResponse(null, { status: 502 });
    const len = Number(upstream.headers.get("content-length") ?? 0);
    if (len > MAX_SOURCE_BYTES) return NextResponse.redirect(source, 302);
    const input = Buffer.from(await upstream.arrayBuffer());

    let sharp: typeof import("sharp") | null = null;
    try {
      sharp = (await import("sharp")).default;
    } catch (err) {
      logError("og-image: sharp no disponible, se redirige a la foto", err);
    }
    if (!sharp) return NextResponse.redirect(source, 302);

    const jpeg = await sharp(input, { failOn: "none" })
      .rotate() // respeta la orientación EXIF de las fotos de celular
      .resize(OG_IMAGE_SIZE.width, OG_IMAGE_SIZE.height, {
        fit: "cover",
        position: "attention",
      })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpeg.length),
        // WhatsApp guarda su propia copia; esto sólo evita regenerarla en
        // cada visita del rastreador.
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    logError("og-image: no se pudo generar", err);
    return new NextResponse(null, { status: 502 });
  }
}

function isAllowedImageHost(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.hostname !== "127.0.0.1") return false;
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const allowed = new Set<string>([
      "bithauss-images-fpdpe5auefacdweh.z03.azurefd.net",
      "bithaussstorage.blob.core.windows.net",
    ]);
    if (supa) allowed.add(new URL(supa).host);
    return allowed.has(u.host);
  } catch {
    return false;
  }
}
