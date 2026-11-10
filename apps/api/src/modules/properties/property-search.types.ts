/**
 * Contract between the property search (PropertiesService.searchForAssistant)
 * and the conversational assistant module. Only PUBLIC listing data crosses
 * this boundary — never owner, company or contact fields.
 */

export interface PropertySearchCriteria {
  /** One of PROPERTY_TYPES (CASA, DEPARTAMENTO, TERRENO, OFICINA, LOCAL_COMERCIAL, BODEGA, OTRO). */
  type?: string;
  /** One of the readable property operations (e.g. VENTA, RENTA). */
  operation?: string;
  /** Square meters. Matched against area_built, falling back to area_total. */
  area_min?: number;
  area_max?: number;
  bedrooms_min?: number;
  bathrooms_min?: number;
  parking_min?: number;
  price_min?: number;
  price_max?: number;
  city?: string;
  state?: string;
  neighborhood?: string;
  /** Already-geocoded point. Properties without coordinates fall back to text location filters. */
  near?: { lat: number; lng: number; radius_km: number };
  /** Free text matched with full-text search (e.g. "obra gris", "vista al mar"). */
  keywords?: string;
  /** Max results returned. Clamped to 1..10, default 5. */
  limit?: number;
}

export interface PropertySearchHit {
  id: string;
  title: string;
  type: string;
  operation: string;
  /**
   * Price for the requested operation (price_sale / price_rent, falling back
   * to the legacy price column). null when the owner chose not to publish the
   * price (show_price = false) — say "precio a consultar".
   */
  price: number | null;
  currency: string;
  /** area_built ?? area_total */
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  neighborhood: string | null;
  city: string;
  state: string;
  /** null when the owner hid the exact address (show_address = false). */
  latitude: number | null;
  longitude: number | null;
  /** Distance from criteria.near, when provided and the property has coordinates. */
  distance_km: number | null;
  featured_image_url: string | null;
  /** Relative path to the public page, e.g. /propiedades/<id> */
  url_path: string;
}

export interface PropertySearchResult {
  hits: PropertySearchHit[];
  /** True when no exact match existed and some criteria were loosened. */
  relaxed: boolean;
  /** Which criteria were loosened, e.g. ["area", "radius", "price"]. */
  relaxed_fields: string[];
}
