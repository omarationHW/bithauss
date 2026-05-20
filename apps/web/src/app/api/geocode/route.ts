import { NextResponse } from "next/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface CacheEntry {
  ts: number;
  result: GeocodeResult | null;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — addresses don't change

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=mx&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "BitHauss/1.0 (real-estate; contact@bithauss.com)",
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status}`);
  }
  const data = (await res.json()) as NominatimItem[];
  const first = data[0];
  if (!first) return null;
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    displayName: first.display_name,
  };
}

export function buildQueryVariants(raw: string): string[] {
  // Build progressively less-specific queries by stripping subdivisions like
  // "Polanco V Sección" that Nominatim doesn't index well.
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const variants = new Set<string>();
  variants.add(parts.join(", "));

  // Remove parts that match "<word> [roman/digit] sección/seccion" or "C.P. NNNNN"
  const cleaned = parts.filter(
    (p) => !/secci[oó]n/i.test(p) && !/^C\.?\s*P\.?\s*\d+$/i.test(p),
  );
  if (cleaned.length && cleaned.join(", ") !== parts.join(", ")) {
    variants.add(cleaned.join(", "));
  }

  // Drop the neighborhood (second part) entirely when we have street + city
  if (cleaned.length >= 3) {
    variants.add([cleaned[0], ...cleaned.slice(2)].join(", "));
  }

  // Just street + last 2 parts (city + country)
  if (cleaned.length >= 3) {
    variants.add([cleaned[0], cleaned[cleaned.length - 2], cleaned[cleaned.length - 1]].join(", "));
  }

  // Neighborhood + city + country fallback
  if (parts.length >= 3 && parts[1]) {
    const neigh = parts[1].replace(/\s+\b(I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)(ª|ra|da|ta|va)?\s*Secci[oó]n\b/i, "").trim();
    if (neigh) {
      variants.add([neigh, parts[parts.length - 2], parts[parts.length - 1]].join(", "));
    }
  }

  return Array.from(variants).filter(Boolean);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const cached = cache.get(q);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ result: cached.result, cached: true });
  }

  const variants = buildQueryVariants(q);

  try {
    let result: GeocodeResult | null = null;
    let matchedQuery: string | null = null;
    for (const variant of variants) {
      result = await geocode(variant);
      if (result) {
        matchedQuery = variant;
        break;
      }
    }
    cache.set(q, { ts: Date.now(), result });
    return NextResponse.json({ result, matchedQuery, cached: false });
  } catch (err) {
    logError("geocode failed", err);
    if (cached) {
      return NextResponse.json({ result: cached.result, cached: true, stale: true });
    }
    return NextResponse.json({ result: null, error: "unavailable" }, { status: 503 });
  }
}
