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
  area_total: number | null; // m² terreno (CASA) / opcional (DEPARTAMENTO)
  area_built: number | null; // m² construcción
  bedrooms: number | null;
  bathrooms: number | null;
  half_bathrooms: number | null;
  parking_spaces: number | null;
  floors: number | null;
  /** Piso del edificio para DEPARTAMENTO. */
  floor_number: number | null;
  maintenance_fee: number | null;

  // Private features (unit-level, NOT building amenities)
  has_service_room: boolean;
  has_storage: boolean;
  has_terrace: boolean;
  has_laundry_room: boolean;
  has_integrated_kitchen: boolean;

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

/**
 * Media attached to a property (images / video / virtual tour).
 */
export interface PropertyMedia {
  id: string;
  property_id: string; // FK → properties.id
  url: string;
  media_type: 'IMAGE' | 'VIDEO' | 'TOUR_360';
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}
