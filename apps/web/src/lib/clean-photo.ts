/**
 * Versión "limpia" (sin marca de agua de la inmobiliaria) de una foto.
 *
 * La marca de agua se hornea en el JPEG al subir la foto (ver watermark.ts),
 * así que la URL guardada en `property_media.url` / `featured_image_url` ya
 * trae el logo de la inmobiliaria. Lo que circula fuera de la plataforma —la
 * ficha técnica y la vista previa del enlace (Open Graph)— NO puede llevarlo:
 * si otro corredor comparte la ficha con su cliente, el logo le permite al
 * cliente saltarse al corredor y contactar a la inmobiliaria directamente.
 *
 * Desde a82d513 el alta y la edición archivan el original intacto en
 * `<uid>/<pid>/originals/<photoKey>.orig` antes de estampar, y la foto
 * estampada vive en `<uid>/<pid>/wm/<photoKey>-<firma>-wm.jpg`. De ahí se
 * deriva el original. Fotos más antiguas (`<uid>/<pid>/<n>-wm.<ext>`) o cuyo
 * archivado falló NO tienen copia limpia: el logo quedó en la única copia.
 */
import { WM_BUCKET, ORIGINALS_DIR } from "./watermark";

const GENERATED_WM_RE = new RegExp(
  `^(.*/storage/v1/object/public/${WM_BUCKET}/[^/?#]+/[^/?#]+)/wm/([^/?#]+)-[0-9a-z]{1,8}-wm\\.jpg(?:[?#].*)?$`,
  "i",
);

/**
 * URL del original archivado para una foto estampada por BitHauss, o null si
 * la URL no sigue el esquema `wm/<photoKey>-<firma>-wm.jpg` (foto sin marca,
 * esquema legado o host externo). Puro: no verifica que el objeto exista.
 */
export function originalPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = GENERATED_WM_RE.exec(url);
  if (!m) return null;
  return `${m[1]}/${ORIGINALS_DIR}/${m[2]}.orig`;
}

/** True cuando la URL apunta a un objeto con marca de agua horneada. */
export function hasBakedWatermark(url: string | null | undefined): boolean {
  return !!url && /-wm\.[a-z0-9]+(\?|#|$)/i.test(url);
}

/**
 * ¿Existe el original archivado? Un HEAD basta: descargar el original
 * completo (PNG de varios MB, hasta 45 a la vez) agotaba el tiempo y la ficha
 * caía a la foto con la marca de la inmobiliaria.
 *
 * "unknown" (red lenta, CORS, tiempo agotado) se trata como que SÍ existe:
 * todo lo que sigue el esquema `wm/` se archivó al subir, y mostrar el logo
 * de la inmobiliaria es justo lo que hay que evitar.
 */
async function originalExists(
  url: string,
  timeoutMs = 8000,
): Promise<"yes" | "no" | "unknown"> {
  if (typeof fetch === "undefined") return "unknown";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!r.ok) return r.status === 404 || r.status === 400 ? "no" : "unknown";
    // `.orig` se sube con el content-type del archivo original; un
    // octet-stream significa que no hay copia limpia utilizable.
    const type = r.headers.get("content-type") ?? "";
    return type.startsWith("image/") ? "yes" : "no";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resuelve (en el navegador) la mejor URL limpia para cada foto: el original
 * archivado salvo que conste que no existe; en ese caso, la URL tal cual
 * (puede traer la marca: ver la nota del encabezado).
 */
export async function resolveCleanPhotoUrls(
  urls: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    urls.map(async (url) => {
      const original = originalPhotoUrl(url);
      out.set(
        url,
        original && (await originalExists(original)) !== "no" ? original : url,
      );
    }),
  );
  return out;
}

/** Variante de servidor (Open Graph): un HEAD basta para saber si existe. */
export async function resolveCleanPhotoUrlServer(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  const original = originalPhotoUrl(url);
  if (!original) return url;
  try {
    const r = await fetch(original, {
      method: "HEAD",
      next: { revalidate: 3600 },
    } as RequestInit);
    const type = r.headers.get("content-type") ?? "";
    // `.orig` se sube con el content-type del archivo original; un
    // octet-stream (o un 4xx) significa que no hay copia limpia utilizable.
    if (r.ok && type.startsWith("image/")) return original;
  } catch {
    /* sin original — se usa la URL estampada */
  }
  return url;
}
