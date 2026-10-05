/**
 * Vista previa del enlace de una propiedad (Open Graph / Twitter) — lo que
 * muestran WhatsApp, iMessage, etc. al compartir /propiedades/<id>.
 *
 * WhatsApp no ejecuta JS: las etiquetas tienen que venir en el HTML del
 * servidor, por eso esto se calcula en `generateMetadata` y no en la página
 * (que es un componente de cliente).
 *
 * Igual que la ficha técnica, la vista previa circula fuera de la plataforma
 * y NO puede llevar nada de la inmobiliaria: ni logo (la foto es el original
 * sin marca de agua cuando existe), ni nombre, ni teléfono, ni la descripción
 * libre (los corredores suelen poner ahí su teléfono). Sólo datos del inmueble.
 */
import type { Metadata } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { propertyOperationLabel } from "@/components/propiedades/property-operations";

export const SHARE_PROPERTY_COLUMNS =
  "id, slug, title, type, operation, status, price, price_sale, price_rent, currency, show_price, area_total, area_built, bedrooms, bathrooms, parking_spaces, neighborhood, city, state, featured_image_url";

export interface SharePropertyRow {
  id: string;
  slug: string | null;
  title: string;
  type: string;
  operation: string;
  status: string;
  price: number | null;
  price_sale: number | null;
  price_rent: number | null;
  currency: string | null;
  show_price: boolean | null;
  area_total: number | null;
  area_built: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  featured_image_url: string | null;
}

/** Tamaño de la imagen generada por /api/og/propiedad/[id]. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_LABELS: Record<string, string> = {
  CASA: "Casa",
  CASA_CONDOMINIO: "Casa en condominio",
  DEPARTAMENTO: "Departamento",
  TERRENO: "Terreno",
  OFICINA: "Oficina",
  LOCAL_COMERCIAL: "Local comercial",
  BODEGA: "Bodega",
  HOTEL: "Hotel",
  DEPARTAMENTO_HOTEL: "Departamento en hotel",
  EDIFICIO: "Edificio",
  NAVE_INDUSTRIAL: "Nave industrial",
  CASA_USO_SUELO: "Casa con uso de suelo",
  QUINTA: "Quinta",
};

function money(n: number, currency: string | null): string {
  const cur = currency || "MXN";
  return `${new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: cur,
    // "$" y la clave al final: es-MX escribe "USD 7,000,000" y quedaba
    // "USD 7,000,000 USD".
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)} ${cur}`;
}

function priceText(p: SharePropertyRow): string {
  // Precio oculto: nunca se filtra, ni siquiera en la vista previa.
  if (p.show_price === false) return "Precio a consultar";
  const sale = p.price_sale ?? p.price ?? 0;
  const rent = p.price_rent ?? p.price ?? 0;
  if (p.operation === "VENTA_RENTA") {
    const parts = [
      p.price_sale && p.price_sale > 0 ? `Venta ${money(p.price_sale, p.currency)}` : null,
      p.price_rent && p.price_rent > 0 ? `Renta ${money(p.price_rent, p.currency)}/mes` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Precio a consultar";
  }
  if (p.operation === "RENTA") {
    return rent > 0 ? `${money(rent, p.currency)}/mes` : "Precio a consultar";
  }
  return sale > 0 ? money(sale, p.currency) : "Precio a consultar";
}

/**
 * "En venta · Casa · $4,500,000 MXN · 3 recámaras · 2 baños · 180 m² ·
 * Polanco, Ciudad de México". Colonia y ciudad nada más: la calle y el
 * número nunca, se muestre o no la dirección en la ficha.
 */
export function buildShareDescription(p: SharePropertyRow): string {
  const area = p.area_built ?? p.area_total;
  const specs = [
    p.bedrooms ? `${p.bedrooms} ${p.bedrooms === 1 ? "recámara" : "recámaras"}` : null,
    p.bathrooms ? `${p.bathrooms} ${p.bathrooms === 1 ? "baño" : "baños"}` : null,
    p.parking_spaces
      ? `${p.parking_spaces} ${p.parking_spaces === 1 ? "estacionamiento" : "estacionamientos"}`
      : null,
    area ? `${area} m²` : null,
  ];
  const place = [p.neighborhood, p.city].filter(Boolean).join(", ") || p.state;
  return [
    propertyOperationLabel(p.operation),
    TYPE_LABELS[p.type] ?? null,
    priceText(p),
    ...specs,
    place,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Metadata completa para una propiedad publicada. */
export function buildPropertyShareMetadata(
  p: SharePropertyRow,
  baseUrl: string,
): Metadata {
  const url = `${baseUrl}/propiedades/${p.slug || p.id}`;
  const description = buildShareDescription(p);
  const images = p.featured_image_url
    ? [
        {
          url: `${baseUrl}/api/og/propiedad/${p.id}`,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          type: "image/jpeg",
          alt: p.title,
        },
      ]
    : undefined;
  return {
    title: `${p.title} | BitHauss`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "BitHauss",
      locale: "es_MX",
      title: p.title,
      description,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: p.title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

/** Cliente anónimo y sin cookies: ve lo mismo que WhatsApp (RLS pública). */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * La propiedad a compartir, o null si no existe o no está PUBLICADA (borrador,
 * pausada, eliminada): esas caen a la vista previa genérica del sitio.
 */
export async function fetchSharedProperty(
  idOrSlug: string,
): Promise<SharePropertyRow | null> {
  const supabase = anonClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("properties")
    .select(SHARE_PROPERTY_COLUMNS)
    .eq(UUID_RE.test(idOrSlug) ? "id" : "slug", idOrSlug)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as SharePropertyRow;
  return row.status === "PUBLICADO" ? row : null;
}

/**
 * Origen público absoluto. NEXT_PUBLIC_SITE_URL si existe; si no, el host de
 * la petición (Azure App Service manda x-forwarded-proto/host).
 */
export function resolveBaseUrl(h: Headers): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
