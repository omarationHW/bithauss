import type { PropertySearchHit } from "@bithauss/types";
import { cleanPhotoSrc } from "@/lib/clean-photo";

/**
 * Same shape the /propiedades cards use: "$7,000,000 MXN" or
 * "$25,000/mes MXN". A missing (or zero) price means the owner hid it.
 */
export function formatHitPrice(
  hit: Pick<PropertySearchHit, "price" | "currency" | "operation">,
): string {
  const { price, operation } = hit;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return "Precio a consultar";
  }
  const currency = (hit.currency || "MXN").toUpperCase();
  let formatted: string;
  try {
    formatted = price.toLocaleString("es-MX", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } catch {
    // Unknown ISO code: still show the number rather than crash the card.
    formatted = `$${Math.round(price).toLocaleString("es-MX")}`;
  }
  const perMonth = operation?.toUpperCase() === "RENTA" ? "/mes" : "";
  return `${formatted}${perMonth} ${currency}`;
}

/** "a 850 m", "a 1.2 km", "a 15 km"; null when there is no distance. */
export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return meters >= 1000 ? "a 1 km" : `a ${meters} m`;
  }
  if (km < 10) {
    const rounded = Math.round(km * 10) / 10;
    return `a ${rounded.toLocaleString("es-MX", { maximumFractionDigits: 1 })} km`;
  }
  return `a ${Math.round(km).toLocaleString("es-MX")} km`;
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

/**
 * Google Maps directions link, ONLY when the owner published the location.
 * null coordinates mean the address is hidden — never guess one.
 */
export function directionsUrl(
  hit: Pick<PropertySearchHit, "latitude" | "longitude">,
): string | null {
  const { latitude, longitude } = hit;
  if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/** "Polanco, Ciudad de México" (or just the city). */
export function formatHitLocation(
  hit: Pick<PropertySearchHit, "neighborhood" | "city" | "state">,
): string {
  const parts = [hit.neighborhood, hit.city || hit.state]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.join(", ");
}

/** "3 recámaras", "1 baño" … Plural rules for the card chips. */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${n === 1 ? one : many}`;
}

export function formatArea(m2: number | null | undefined): string | null {
  if (m2 == null || !Number.isFinite(m2) || m2 <= 0) return null;
  return `${Math.round(m2).toLocaleString("es-MX")} m²`;
}

/**
 * Card photo without the agency watermark: same /api/foto route the public
 * listing uses. Small width — the card is ~360px wide.
 */
export function hitImageSrc(hit: Pick<PropertySearchHit, "featured_image_url">): string | null {
  return cleanPhotoSrc(hit.featured_image_url, 480);
}

/**
 * The API returns a relative path; anything else (absolute URL, protocol-
 * relative) is refused so a bad payload cannot turn the card into an
 * off-site link.
 */
export function safePropertyPath(hit: Pick<PropertySearchHit, "url_path" | "id">): string {
  const path = hit.url_path;
  if (typeof path === "string" && /^\/propiedades\/[^/?#\s]+$/.test(path)) return path;
  return `/propiedades/${encodeURIComponent(hit.id)}`;
}
