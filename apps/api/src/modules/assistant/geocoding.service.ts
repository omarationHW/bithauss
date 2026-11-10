import { Injectable, Logger } from '@nestjs/common';

import {
  GEOCODE_CACHE_MAX,
  GEOCODE_TIMEOUT_MS,
  GEOCODE_TTL_MS,
  NOMINATIM_USER_AGENT,
} from './assistant.constants';

export interface GeoPoint {
  lat: number;
  lng: number;
  /**
   * Half the diagonal of the place's bounding box, in km, when Nominatim gives
   * one. A municipality ("Huixquilucan") spans ~10 km from its centroid, a
   * colonia much less — the caller sizes the search radius with it.
   */
  extent_km?: number;
}

interface CacheEntry {
  ts: number;
  point: GeoPoint | null;
}

interface NominatimItem {
  lat: string;
  lon: string;
  /** [south, north, west, east] as strings. */
  boundingbox?: string[];
}

/**
 * Server-side twin of `apps/web/src/app/api/geocode/route.ts`: Nominatim,
 * Mexico only, same User-Agent. Results (including "not found") are cached
 * for 24 h in a bounded LRU — place names don't move, and Nominatim's
 * fair-use policy bans IPs that hammer it.
 *
 * Never throws: `null` means "could not place it", and the caller falls back
 * to text filters.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async geocode(place: string): Promise<GeoPoint | null> {
    const key = place.trim().toLowerCase();
    if (!key) return null;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < GEOCODE_TTL_MS) {
      // Re-insert to mark as most recently used.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.point;
    }

    try {
      const point = await this.lookup(place.trim());
      this.remember(key, point);
      return point;
    } catch (err) {
      // Transient failures are not cached: the next request may succeed.
      this.logger.warn(`Nominatim no disponible: ${(err as Error).message}`);
      return cached ? cached.point : null;
    }
  }

  private async lookup(query: string): Promise<GeoPoint | null> {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      '&countrycodes=mx&format=json&limit=1&addressdetails=0';
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = (await res.json()) as NominatimItem[];
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const extent = boundingBoxExtentKm(first.boundingbox);
    return extent === null ? { lat, lng } : { lat, lng, extent_km: extent };
  }

  private remember(key: string, point: GeoPoint | null): void {
    this.cache.delete(key);
    this.cache.set(key, { ts: Date.now(), point });
    while (this.cache.size > GEOCODE_CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}

/** Half-diagonal of a Nominatim bounding box in km, or null if absent/invalid. */
export function boundingBoxExtentKm(bbox: string[] | undefined): number | null {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const [south, north, west, east] = bbox.map(Number);
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null;
  const midLat = (((south as number) + (north as number)) / 2) * (Math.PI / 180);
  const dLatKm = Math.abs((north as number) - (south as number)) * 111.32;
  const dLngKm = Math.abs((east as number) - (west as number)) * 111.32 * Math.cos(midLat);
  return Math.round((Math.hypot(dLatKm, dLngKm) / 2) * 10) / 10;
}
