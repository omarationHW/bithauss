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
  price: number; // decimal in DB
  currency: string; // MXN | USD
  accepts_crypto: boolean;

  // Dimensions & features
  area_total: number | null; // m²
  area_built: number | null; // m²
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  floors: number | null;

  // Location
  address_line: string | null;
  neighborhood: string | null; // Colonia
  city: string;
  state: string; // Estado
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;

  // Extras
  amenities: string[]; // JSONB array of amenity slugs
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
