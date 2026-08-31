import { NextResponse } from "next/server";
import { logError } from "@/lib/log";
import { buildQueryVariants } from "./variants";
import { enforceRateLimit } from "@/lib/rate-limit";

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

// BH-10: /api/geocode proxies Nominatim, whose fair-use policy is enforced by
// banning the caller's IP. An unthrottled loop here takes address lookup down
// for every user of the platform, so the limit protects an upstream we do not
// control.
const RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const;

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "geocode", RATE_LIMIT);
  if (limited) return limited;

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
