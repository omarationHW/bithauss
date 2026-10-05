import { NextRequest, NextResponse } from "next/server";
import {
  CLEAN_PHOTO_WIDTHS,
  originalPhotoUrl,
  resolveCleanPhotoUrlServer,
} from "@/lib/clean-photo";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

export const runtime = "nodejs";

/**
 * Foto pública de una propiedad SIN la marca de agua de la inmobiliaria.
 *
 * Recibe la URL estampada (`.../wm/<photoKey>-<firma>-wm.jpg`) y entrega el
 * original archivado, redimensionado a uno de CLEAN_PHOTO_WIDTHS en JPEG.
 * Si no hay original (fotos antiguas), redirige a la foto estampada: es la
 * única copia que existe.
 *
 * Solo acepta URLs con el esquema `wm/` del bucket de nuestro Supabase, así
 * que no es un proxy abierto.
 */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
// Una galería pide ~20 fotos y un listado una por tarjeta.
const RATE_LIMIT = { limit: 600, windowMs: 60_000 } as const;

// Caché en memoria del resultado: la misma foto la ven muchos visitantes.
const CACHE_MAX_ENTRIES = 150;
const cache = new Map<string, Buffer>();

function remember(key: string, value: Buffer) {
  cache.set(key, value);
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function jpegResponse(body: Buffer) {
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.length),
      // La URL lleva la firma de la foto: si la foto cambia, cambia la URL.
      "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
    },
  });
}

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, "foto", RATE_LIMIT);
  if (limited) return limited;

  const url = req.nextUrl.searchParams.get("u") ?? "";
  const width = Number(req.nextUrl.searchParams.get("w"));
  if (
    !isOurStorage(url) ||
    !originalPhotoUrl(url) ||
    !(CLEAN_PHOTO_WIDTHS as readonly number[]).includes(width)
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const key = `${width}:${url}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return jpegResponse(cached);
  }

  const source = await resolveCleanPhotoUrlServer(url);
  // Sin original: la estampada es la única copia.
  if (!source || source === url) return NextResponse.redirect(url, 302);

  try {
    const upstream = await fetch(source, { cache: "no-store" });
    if (!upstream.ok) return NextResponse.redirect(url, 302);
    const len = Number(upstream.headers.get("content-length") ?? 0);
    if (len > MAX_SOURCE_BYTES) return NextResponse.redirect(url, 302);
    const input = Buffer.from(await upstream.arrayBuffer());

    let sharp: typeof import("sharp") | null = null;
    try {
      sharp = (await import("sharp")).default;
    } catch (err) {
      logError("foto: sharp no disponible, se redirige al original", err);
    }
    if (!sharp) return NextResponse.redirect(source, 302);

    const jpeg = await sharp(input, { failOn: "none" })
      .rotate() // orientación EXIF de las fotos de celular
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    remember(key, jpeg);
    return jpegResponse(jpeg);
  } catch (err) {
    logError("foto: no se pudo generar", err);
    return NextResponse.redirect(url, 302);
  }
}

/** Solo nuestro Supabase: el esquema `wm/` por sí solo no fija el host. */
function isOurStorage(url: string): boolean {
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supa) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === new URL(supa).host;
  } catch {
    return false;
  }
}
