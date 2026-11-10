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
}

interface CacheEntry {
  ts: number;
  point: GeoPoint | null;
}

interface NominatimItem {
  lat: string;
  lon: string;
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
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
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
