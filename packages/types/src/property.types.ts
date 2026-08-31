import {
  PropertyType,
  PropertyOperation,
  PropertyStatus,
  BrcStatus,
} from './enums';

/**
 * Real-estate property listing.
 */
export interface Property {
  id: string;
  owner_id: string; // FK → profiles.id (publisher)
  company_id: string | null; // FK → company_profiles.id

  // Core info
  title: string;
  slug: string;
  description: string | null;
  type: PropertyType;
  operation: PropertyOperation;
  status: PropertyStatus;

  // Pricing
  price: number; // legacy; for VENTA_RENTA use price_sale / price_rent
  price_sale: number | null;
  price_rent: number | null;
  currency: string; // MXN | USD
  accepts_crypto: boolean;
  /** When false, public listing shows "Precio a consultar" instead of the amount. */
  show_price: boolean;

  // Dimensions & features
  // Which of these apply (and which are mandatory) is decided by the
  // "DATOS DEL INMUEBLE × TIPO DE PROPIEDAD" matrix — see
  // PROPERTY_FIELD_MATRIX in @bithauss/validators.
  area_total: number | null; // m² totales del terreno
  area_built: number | null; // m² de construcción
  /**
   * Recámaras (casa, depto) / habitaciones (hotel).
   *
   * ONLY that. EDIFICIO used to borrow this column for its unit count; since
   * migration 027 that lives in `private_units`.
   */
  bedrooms: number | null;
  /** No. de privados / espacios: oficina, local, bodega, nave, edificio. */
  private_units: number | null;
  bathrooms: number | null;
  half_bathrooms: number | null;
  parking_spaces: number | null;
  /** Niveles construidos. */
  floors: number | null;
  /** Nivel en el que se encuentra (departamento, oficina). */
  floor_number: number | null;
  maintenance_fee: number | null;
  /** Antigüedad en años. */
  age_years: number | null;

  // Private features (unit-level, NOT building amenities)
  has_service_room: boolean;
  has_storage: boolean;
  /**
   * Matrix row "Terraza", tri-state: null means the publisher never answered.
   * Nullable since migration 027 — a `false` default would answer for them.
   */
  has_terrace: boolean | null;
  has_laundry_room: boolean;
  has_integrated_kitchen: boolean;
  /** Matrix row "Amueblado", tri-state (null = sin responder). */
  is_furnished: boolean | null;
  /**
   * Matrix row "¿Aplica traspaso?" — LOCAL_COMERCIAL only, tri-state.
   * Replaced TRASPASO as a `PropertyOperation`.
   */
  applies_traspaso: boolean | null;

  // Location
  address_line: string | null;
  neighborhood: string | null; // Colonia
  city: string;
  state: string; // Estado
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  /** When false, the public listing hides street/door and shows colonia+ciudad only. */
  show_address: boolean;

  // Extras
  amenities: string[]; // JSONB array — common areas only (alberca, gym, etc.)
  /**
   * The publisher confirmed their amenities selection ("forzar a responder").
   * An empty `amenities` array cannot mean "unanswered", because "sin
   * amenidades" is a legitimate answer.
   */
  amenities_answered: boolean;
  featured_image_url: string | null;

  // BRC
  brc_status: BrcStatus;
  brc_certificate_id: string | null; // FK → brc_certificates.id

  // Metrics
  view_count: number;
  lead_count: number;

  // Timestamps
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Where a VIDEO row's content lives (migration 030). */
export type PropertyMediaProvider = 'UPLOAD' | 'YOUTUBE' | 'VIMEO';

export type PropertyMediaType = 'IMAGE' | 'VIDEO' | 'TOUR_360';

/**
 * Media attached to a property (images / video / virtual tour).
 *
 * Video may be hosted by us (`provider: 'UPLOAD'`, `url` points at the PUBLIC
 * `property-videos` bucket) or embedded from YouTube/Vimeo. For the embedded
 * case `url` is the CANONICAL provider URL rebuilt from `external_id` — never
 * the string the publisher pasted — because it ends up in an <iframe src>.
 */
export interface PropertyMedia {
  id: string;
  property_id: string; // FK → properties.id
  url: string;
  media_type: PropertyMediaType;
  /** Null for images; required for VIDEO rows (constraint in migración 030). */
  provider: PropertyMediaProvider | null;
  /** Provider-side id. Null for UPLOAD (the storage object IS the id). */
  external_id: string | null;
  /** Poster frame, so the ficha never downloads the video just to render it. */
  thumbnail_url: string | null;
  duration_seconds: number | null;
  /** First item of its media_type on the ficha. Unique per property + type. */
  is_primary: boolean;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}
