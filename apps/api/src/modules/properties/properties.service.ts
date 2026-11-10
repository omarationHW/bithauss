import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import { assertNotBrcFrozen } from './brc-freeze';
import { randomBytes } from 'crypto';
import type {
  PropertySearchCriteria,
  PropertySearchHit,
  PropertySearchResult,
} from './property-search.types';

// ────────────────────────────────────────────────────────────
// DTOs
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// DTOs (class-validator)
// ────────────────────────────────────────────────────────────
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsIn,
  Length,
  Min,
  Max,
  IsArray,
  IsUrl,
} from 'class-validator';

const PROPERTY_TYPES = ['CASA', 'CASA_CONDOMINIO', 'DEPARTAMENTO', 'TERRENO', 'OFICINA', 'LOCAL_COMERCIAL', 'BODEGA', 'HOTEL', 'EDIFICIO', 'NAVE_INDUSTRIAL', 'CASA_USO_SUELO', 'OTRO'] as const;
/**
 * Operations a listing may be created or updated with.
 *
 * TRASPASO was retired: a traspaso is an attribute of a commercial unit
 * (`applies_traspaso`, Local Comercial only), not a way of transacting the
 * property. It stays in the Postgres enum because values cannot be dropped,
 * so historical rows keep reading fine — but nothing may write it again.
 */
const PROPERTY_OPERATIONS = ['VENTA', 'RENTA', 'VENTA_RENTA'] as const;

/** Retired operations: readable on historical rows, never writable. */
const LEGACY_PROPERTY_OPERATIONS = ['TRASPASO'] as const;

/** Everything a stored row may carry — used by read-side filters only. */
const READABLE_PROPERTY_OPERATIONS = [
  ...PROPERTY_OPERATIONS,
  ...LEGACY_PROPERTY_OPERATIONS,
] as const;
const PROPERTY_STATUSES = ['BORRADOR', 'PENDIENTE', 'PUBLICADO', 'PAUSADO', 'VENDIDO', 'RENTADO'] as const;
const PROPERTY_BRC_STATUSES = ['SIN_BRC', 'EN_PROCESO', 'CERTIFICADO', 'RECHAZADO'] as const;
const CURRENCIES = ['MXN', 'USD'] as const;

export class CreatePropertyDto {
  @IsOptional() @IsUUID() company_id?: string;

  @IsString() @Length(3, 200) title!: string;

  @IsOptional() @IsString() @Length(0, 5000) description?: string;

  @IsString() @IsIn(PROPERTY_TYPES as unknown as string[]) type!: string;

  @IsString() @IsIn(PROPERTY_OPERATIONS as unknown as string[]) operation!: string;

  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000) price?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000) price_sale?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000) price_rent?: number;

  @IsOptional() @IsString() @IsIn(CURRENCIES as unknown as string[]) currency?: string;

  @IsOptional() @IsBoolean() accepts_crypto?: boolean;
  @IsOptional() @IsBoolean() show_price?: boolean;

  @IsOptional() @IsNumber() @Min(0) area_total?: number;
  @IsOptional() @IsNumber() @Min(0) area_built?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bathrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) half_bathrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) parking_spaces?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) floors?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500) floor_number?: number;
  @IsOptional() @IsNumber() @Min(0) maintenance_fee?: number;

  // Matrix rows added in migration 027 (see PROPERTY_FIELD_MATRIX in
  // @bithauss/validators for which types require which).
  @IsOptional() @IsNumber() @Min(0) @Max(500) age_years?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10_000) private_units?: number;
  /** Tri-state ("forzar a responder"): null/absent means unanswered. */
  @IsOptional() @IsBoolean() is_furnished?: boolean;
  /** Tri-state, Local Comercial only. Replaced the TRASPASO operation. */
  @IsOptional() @IsBoolean() applies_traspaso?: boolean;
  /** The publisher confirmed their amenities selection (may be empty). */
  @IsOptional() @IsBoolean() amenities_answered?: boolean;

  @IsOptional() @IsBoolean() has_service_room?: boolean;
  @IsOptional() @IsBoolean() has_storage?: boolean;
  @IsOptional() @IsBoolean() has_terrace?: boolean;
  @IsOptional() @IsBoolean() has_laundry_room?: boolean;
  @IsOptional() @IsBoolean() has_integrated_kitchen?: boolean;

  @IsOptional() @IsString() @Length(0, 300) address_line?: string;
  @IsOptional() @IsString() @Length(0, 200) street?: string;
  @IsOptional() @IsString() @Length(0, 20) exterior_number?: string;
  @IsOptional() @IsString() @Length(0, 20) interior_number?: string;
  @IsOptional() @IsString() @Length(0, 200) neighborhood?: string;

  @IsString() @Length(1, 100) city!: string;
  @IsString() @Length(1, 100) state!: string;

  @IsOptional() @IsString() @Length(0, 20) zip_code?: string;
  @IsOptional() @IsString() @Length(0, 100) country?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsBoolean() show_address?: boolean;

  @IsOptional() @IsArray() amenities?: unknown[];

  @IsOptional() @IsUrl({ require_tld: false }) featured_image_url?: string;
}

export class UpdatePropertyDto {
  @IsOptional() @IsUUID() company_id?: string;
  @IsOptional() @IsString() @Length(3, 200) title?: string;
  @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @IsOptional() @IsString() @IsIn(PROPERTY_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsString() @IsIn(PROPERTY_OPERATIONS as unknown as string[]) operation?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000) price?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000) price_sale?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000) price_rent?: number;
  @IsOptional() @IsString() @IsIn(CURRENCIES as unknown as string[]) currency?: string;
  @IsOptional() @IsBoolean() accepts_crypto?: boolean;
  @IsOptional() @IsBoolean() show_price?: boolean;
  @IsOptional() @IsNumber() @Min(0) area_total?: number;
  @IsOptional() @IsNumber() @Min(0) area_built?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bathrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) half_bathrooms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) parking_spaces?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) floors?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(500) floor_number?: number;
  @IsOptional() @IsNumber() @Min(0) maintenance_fee?: number;
  // Matrix rows added in migration 027.
  @IsOptional() @IsNumber() @Min(0) @Max(500) age_years?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10_000) private_units?: number;
  @IsOptional() @IsBoolean() is_furnished?: boolean;
  @IsOptional() @IsBoolean() applies_traspaso?: boolean;
  @IsOptional() @IsBoolean() amenities_answered?: boolean;
  @IsOptional() @IsBoolean() has_service_room?: boolean;
  @IsOptional() @IsBoolean() has_storage?: boolean;
  @IsOptional() @IsBoolean() has_terrace?: boolean;
  @IsOptional() @IsBoolean() has_laundry_room?: boolean;
  @IsOptional() @IsBoolean() has_integrated_kitchen?: boolean;
  @IsOptional() @IsString() @Length(0, 300) address_line?: string;
  @IsOptional() @IsString() @Length(0, 200) street?: string;
  @IsOptional() @IsString() @Length(0, 20) exterior_number?: string;
  @IsOptional() @IsString() @Length(0, 20) interior_number?: string;
  @IsOptional() @IsString() @Length(0, 200) neighborhood?: string;
  @IsOptional() @IsString() @Length(1, 100) city?: string;
  @IsOptional() @IsString() @Length(1, 100) state?: string;
  @IsOptional() @IsString() @Length(0, 20) zip_code?: string;
  @IsOptional() @IsString() @Length(0, 100) country?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsBoolean() show_address?: boolean;
  @IsOptional() @IsArray() amenities?: unknown[];
  @IsOptional() @IsUrl({ require_tld: false }) featured_image_url?: string;
}

export class PropertyFilters {
  @IsOptional() @IsNumber() @Min(1) @Max(1000) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @Length(0, 200) search?: string;
  @IsOptional() @IsString() @IsIn(PROPERTY_TYPES as unknown as string[]) type?: string;
  // Read-side: a filter may still narrow to a retired operation so historical
  // listings remain reachable.
  @IsOptional() @IsString() @IsIn(READABLE_PROPERTY_OPERATIONS as unknown as string[]) operation?: string;
  @IsOptional() @IsString() @IsIn(PROPERTY_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() @Length(0, 100) city?: string;
  @IsOptional() @IsString() @Length(0, 100) state?: string;
  @IsOptional() @IsNumber() @Min(0) price_min?: number;
  @IsOptional() @IsNumber() @Min(0) price_max?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bedrooms?: number;
  @IsOptional() @IsString() @IsIn(PROPERTY_BRC_STATUSES as unknown as string[]) brc_status?: string;
}

// ────────────────────────────────────────────────────────────
// Assistant search helpers
// ────────────────────────────────────────────────────────────

/**
 * Strips everything but letters, digits, spaces, apostrophes and dashes.
 * Safe for tsquery input and for values embedded in PostgREST filter strings
 * (no `,` `(` `)` `"` `*` `%` `_` survive).
 */
/**
 * Listings are typed by hand, often without accents ("juarez", "JESUS DEL
 * MONTE"), while people (and the model) write "Juárez". Turning each accented
 * letter into the single-character LIKE wildcard `_` matches both spellings
 * without a migration (no unaccent extension). Run AFTER sanitizeSearchText,
 * which strips any user-supplied `_`, so the only wildcards are ours.
 */
export function accentInsensitive(text: string): string {
  return text.replace(/[áéíóúüñ]/giu, '_');
}

export function sanitizeSearchText(raw: unknown, max = 200): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Public columns only. Never owner_id, company_id, address_line, zip_code,
 * contact or BRC fields. show_price / show_address are read to honour the
 * owner's privacy choices and are not returned.
 */
const ASSISTANT_SEARCH_COLUMNS =
  'id, title, type, operation, price, price_sale, price_rent, currency, show_price, show_address, ' +
  'area_built, area_total, bedrooms, bathrooms, parking_spaces, neighborhood, city, state, ' +
  'latitude, longitude, featured_image_url, published_at';

/** Rows fetched per query; ranking and radius filtering happen in JS. */
const ASSISTANT_CANDIDATE_LIMIT = 50;
const ASSISTANT_DEFAULT_LIMIT = 5;
const ASSISTANT_MAX_LIMIT = 10;
const ASSISTANT_DEFAULT_RADIUS_KM = 3;
/** Cap on the requested radius, so the bounding box stays meaningful. */
const ASSISTANT_MAX_RADIUS_KM = 50;
/** Relaxation never widens the radius beyond this. */
const ASSISTANT_MAX_RELAXED_RADIUS_KM = 25;

interface AssistantSearchRow {
  id: string;
  title: string;
  type: string;
  operation: string;
  price: unknown;
  price_sale: unknown;
  price_rent: unknown;
  currency: string;
  show_price: boolean | null;
  show_address: boolean | null;
  area_built: unknown;
  area_total: unknown;
  bedrooms: unknown;
  bathrooms: unknown;
  parking_spaces: unknown;
  neighborhood: string | null;
  city: string;
  state: string;
  latitude: unknown;
  longitude: unknown;
  featured_image_url: string | null;
  published_at: string | null;
}

/** The loosen-able part of a query. Type and operation are never relaxed. */
interface AssistantSearchPlan {
  area_min: number | null;
  area_max: number | null;
  price_min: number | null;
  price_max: number | null;
  radius_km: number | null;
  keywords: string;
}

/** PostgREST numeric columns may arrive as strings. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A positive finite number from untrusted (LLM-produced) input, else null. */
function positive(v: unknown): number | null {
  const n = toNum(v);
  return n !== null && n > 0 ? n : null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * PostgREST `or` filter for "primary within [min,max], or primary is null and
 * fallback within [min,max]" — e.g. area_built falling back to area_total.
 */
function rangeWithFallbackFilter(
  primary: string,
  fallback: string,
  min: number | null,
  max: number | null,
): string | null {
  const bounds = (col: string) =>
    [min !== null ? `${col}.gte.${min}` : null, max !== null ? `${col}.lte.${max}` : null]
      .filter(Boolean)
      .join(',');
  if (min === null && max === null) return null;
  return `and(${bounds(primary)}),and(${primary}.is.null,${bounds(fallback)})`;
}

/** A VENTA_RENTA listing is both for sale and for rent. */
function operationsMatching(operation: string): string[] {
  if (operation === 'VENTA' || operation === 'RENTA') return [operation, 'VENTA_RENTA'];
  return [operation];
}

/** Price column for the requested operation; the legacy `price` is the fallback. */
function priceColumnFor(operation: string | undefined): 'price_sale' | 'price_rent' | null {
  if (operation === 'VENTA') return 'price_sale';
  if (operation === 'RENTA') return 'price_rent';
  return null;
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  // ── helpers ──────────────────────────────────────────────

  /**
   * Converts a title like "Casa Moderna en Polanco" to
   * "casa-moderna-en-polanco-a1b2c3".
   */
  private generateSlug(title: string): string {
    const base = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const suffix = randomBytes(3).toString('hex'); // 6-char hex
    return `${base}-${suffix}`;
  }

  /**
   * Verify that the given property belongs to the owner.
   * Returns the property row or throws.
   */
  private async verifyOwnership(id: string, ownerId: string) {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      this.logger.warn(`Property not found: ${id}`);
      throw new NotFoundException('Property not found');
    }

    if (data.owner_id !== ownerId) {
      throw new ForbiddenException(
        'You do not have permission to modify this property',
      );
    }

    return data;
  }

  // ── CRUD ─────────────────────────────────────────────────

  /**
   * Create a new property.
   */
  async create(ownerId: string, dto: CreatePropertyDto) {
    const supabase = this.supabaseConfig.getAdminClient();

    const slug = this.generateSlug(dto.title);

    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id: ownerId,
        company_id: dto.company_id ?? null,
        title: dto.title,
        slug,
        description: dto.description ?? null,
        type: dto.type,
        operation: dto.operation,
        price: dto.price ?? null,
        price_sale: dto.price_sale ?? null,
        price_rent: dto.price_rent ?? null,
        currency: dto.currency ?? 'MXN',
        accepts_crypto: dto.accepts_crypto ?? false,
        show_price: dto.show_price ?? true,
        area_total: dto.area_total ?? null,
        area_built: dto.area_built ?? null,
        bedrooms: dto.bedrooms ?? null,
        bathrooms: dto.bathrooms ?? null,
        half_bathrooms: dto.half_bathrooms ?? null,
        parking_spaces: dto.parking_spaces ?? null,
        floors: dto.floors ?? null,
        floor_number: dto.floor_number ?? null,
        maintenance_fee: dto.maintenance_fee ?? null,
        age_years: dto.age_years ?? null,
        private_units: dto.private_units ?? null,
        // Tri-state: an unanswered "Amueblado"/"Terraza"/"¿Aplica traspaso?"
        // must persist as NULL. Defaulting to false would answer "No" on the
        // publisher's behalf, which is what "forzar a responder" forbids.
        is_furnished: dto.is_furnished ?? null,
        applies_traspaso: dto.applies_traspaso ?? null,
        has_service_room: dto.has_service_room ?? false,
        has_storage: dto.has_storage ?? false,
        has_terrace: dto.has_terrace ?? null,
        has_laundry_room: dto.has_laundry_room ?? false,
        has_integrated_kitchen: dto.has_integrated_kitchen ?? false,
        address_line: dto.address_line ?? null,
        street: dto.street ?? null,
        exterior_number: dto.exterior_number ?? null,
        interior_number: dto.interior_number ?? null,
        neighborhood: dto.neighborhood ?? null,
        city: dto.city,
        state: dto.state,
        zip_code: dto.zip_code ?? null,
        country: dto.country ?? 'MX',
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        show_address: dto.show_address ?? true,
        amenities: dto.amenities ?? [],
        amenities_answered: dto.amenities_answered ?? false,
        featured_image_url: dto.featured_image_url ?? null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to create property: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * List properties with pagination, search, and filters.
   * Returns rows together with their media.
   */
  async findAll(filters: PropertyFilters) {
    const supabase = this.supabaseConfig.getAdminClient();

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('properties')
      .select('*, property_media(*)', { count: 'exact' });

    // Full-text search via the search_vector column.
    // Use websearch_to_tsquery (sanitization-aware) and additionally strip
    // characters that could be misinterpreted by Postgres tsquery operators.
    if (filters.search) {
      const sanitized = sanitizeSearchText(filters.search);
      if (sanitized) {
        query = query.textSearch('search_vector', sanitized, { type: 'websearch' });
      }
    }

    if (filters.type) query = query.eq('type', filters.type);
    if (filters.operation) query = query.eq('operation', filters.operation);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.city) query = query.ilike('city', `%${filters.city}%`);
    if (filters.state) query = query.ilike('state', `%${filters.state}%`);
    if (filters.price_min) query = query.gte('price', filters.price_min);
    if (filters.price_max) query = query.lte('price', filters.price_max);
    if (filters.bedrooms) query = query.gte('bedrooms', filters.bedrooms);
    if (filters.brc_status) query = query.eq('brc_status', filters.brc_status);

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to list properties: ${error.message}`);
      throw error;
    }

    return {
      data,
      meta: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  /**
   * Get a single property by ID, including its media.
   */
  async findById(id: string) {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('properties')
      .select('*, property_media(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      this.logger.warn(`Property not found: ${id}`);
      throw new NotFoundException('Property not found');
    }

    return data;
  }

  /**
   * Get all properties owned by a user, optionally filtered by status.
   */
  async findByOwner(ownerId: string, status?: string) {
    const supabase = this.supabaseConfig.getAdminClient();

    let query = supabase
      .from('properties')
      .select('*, property_media(*)')
      .eq('owner_id', ownerId)
      .neq('status', 'ELIMINADO')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list properties for owner ${ownerId}: ${error.message}`,
      );
      throw error;
    }

    return data;
  }

  /**
   * Update a property (only if the caller is the owner).
   */
  async update(id: string, ownerId: string, dto: UpdatePropertyDto) {
    await this.verifyOwnership(id, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();
    await assertNotBrcFrozen(supabase, id);

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only set fields that were explicitly provided
    const fields: (keyof UpdatePropertyDto)[] = [
      'company_id',
      'title',
      'description',
      'type',
      'operation',
      'price',
      'currency',
      'accepts_crypto',
      'area_total',
      'area_built',
      'bedrooms',
      'private_units',
      'bathrooms',
      'half_bathrooms',
      'parking_spaces',
      'floors',
      'floor_number',
      'maintenance_fee',
      'age_years',
      'is_furnished',
      'has_terrace',
      'applies_traspaso',
      'address_line',
      'street',
      'exterior_number',
      'interior_number',
      'neighborhood',
      'city',
      'state',
      'zip_code',
      'country',
      'latitude',
      'longitude',
      'amenities',
      'amenities_answered',
      'featured_image_url',
    ];

    for (const field of fields) {
      if (dto[field] !== undefined) {
        updateData[field] = dto[field];
      }
    }

    // Regenerate slug when title changes
    if (dto.title !== undefined) {
      updateData.slug = this.generateSlug(dto.title);
    }

    const { data, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select('*, property_media(*)')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update property ${id}: ${error?.message}`);
      throw new NotFoundException('Property not found');
    }

    return data;
  }

  /**
   * Soft-delete a property by setting status to ELIMINADO.
   */
  async delete(id: string, ownerId: string) {
    await this.verifyOwnership(id, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('properties')
      .update({
        status: 'ELIMINADO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to delete property ${id}: ${error?.message}`);
      throw new NotFoundException('Property not found');
    }

    return data;
  }

  /**
   * Publish a property.
   */
  async publish(id: string, ownerId: string) {
    await this.verifyOwnership(id, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('properties')
      .update({
        status: 'PUBLICADO',
        published_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*, property_media(*)')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to publish property ${id}: ${error?.message}`);
      throw new NotFoundException('Property not found');
    }

    return data;
  }

  /**
   * Pause a property.
   */
  async pause(id: string, ownerId: string) {
    await this.verifyOwnership(id, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('properties')
      .update({
        status: 'PAUSADO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, property_media(*)')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to pause property ${id}: ${error?.message}`);
      throw new NotFoundException('Property not found');
    }

    return data;
  }

  /**
   * Increment the view count for a property.
   */
  async incrementViewCount(id: string) {
    const supabase = this.supabaseConfig.getAdminClient();

    const { error } = await supabase.rpc('increment_property_view_count', {
      property_id: id,
    });

    // If the RPC doesn't exist yet, fall back to a manual update
    if (error) {
      this.logger.warn(
        `RPC increment_property_view_count failed, using fallback: ${error.message}`,
      );

      const { data: property } = await supabase
        .from('properties')
        .select('view_count')
        .eq('id', id)
        .single();

      if (property) {
        await supabase
          .from('properties')
          .update({ view_count: (property.view_count ?? 0) + 1 })
          .eq('id', id);
      }
    }
  }

  // ── Assistant search ─────────────────────────────────────

  /**
   * Search PUBLISHED listings for the conversational assistant.
   *
   * - Only public columns leave this method (see ASSISTANT_SEARCH_COLUMNS);
   *   hidden prices come back null and hidden addresses without coordinates.
   * - Area matches area_built, falling back to area_total when it is null
   *   (PostgREST `or` filter, so it is exact in the database).
   * - `near`: lat/lng bounding box in the query, exact haversine radius in JS,
   *   sorted by distance. If city/neighborhood are also given, listings
   *   WITHOUT coordinates matching that text are included after the geo hits
   *   (distance_km null). With `near`, the text location only applies to
   *   those coordinate-less listings — the point is the authority.
   * - Zero hits → relax cumulatively: area ±20%, radius ×2 (≤25 km),
   *   price ±15%, drop keywords, then any area (closest size first). Stops at
   *   the first non-empty result; at most 6 queries. Type and operation are
   *   never relaxed.
   */
  async searchForAssistant(criteria: PropertySearchCriteria): Promise<PropertySearchResult> {
    const c = criteria ?? {};
    const rawLimit = toNum(c.limit);
    const limit =
      rawLimit === null
        ? ASSISTANT_DEFAULT_LIMIT
        : Math.min(ASSISTANT_MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)));

    const lat = toNum(c.near?.lat);
    const lng = toNum(c.near?.lng);
    const near =
      lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        ? {
            lat,
            lng,
            radius_km: Math.min(
              positive(c.near?.radius_km) ?? ASSISTANT_DEFAULT_RADIUS_KM,
              ASSISTANT_MAX_RADIUS_KM,
            ),
          }
        : null;

    let areaMin = positive(c.area_min);
    let areaMax = positive(c.area_max);
    if (areaMin !== null && areaMax !== null && areaMin > areaMax) {
      [areaMin, areaMax] = [areaMax, areaMin];
    }
    let priceMin = positive(c.price_min);
    let priceMax = positive(c.price_max);
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }
    // Ranking target for "closest area": the midpoint of a range, else the bound.
    const areaTarget =
      areaMin !== null && areaMax !== null ? (areaMin + areaMax) / 2 : areaMin ?? areaMax;

    const initial: AssistantSearchPlan = {
      area_min: areaMin,
      area_max: areaMax,
      price_min: priceMin,
      price_max: priceMax,
      radius_km: near?.radius_km ?? null,
      keywords: sanitizeSearchText(c.keywords),
    };

    const round = (n: number) => Math.round(n * 100) / 100;
    const relaxSteps: { field: string; apply: (p: AssistantSearchPlan) => AssistantSearchPlan | null }[] = [
      {
        field: 'area',
        apply: (p) =>
          p.area_min === null && p.area_max === null
            ? null
            : {
                ...p,
                area_min: p.area_min !== null ? round(p.area_min * 0.8) : null,
                area_max: p.area_max !== null ? round(p.area_max * 1.2) : null,
              },
      },
      {
        field: 'radius',
        apply: (p) =>
          p.radius_km === null || p.radius_km >= ASSISTANT_MAX_RELAXED_RADIUS_KM
            ? null
            : { ...p, radius_km: Math.min(p.radius_km * 2, ASSISTANT_MAX_RELAXED_RADIUS_KM) },
      },
      {
        field: 'price',
        apply: (p) =>
          p.price_min === null && p.price_max === null
            ? null
            : {
                ...p,
                price_min: p.price_min !== null ? round(p.price_min * 0.85) : null,
                price_max: p.price_max !== null ? round(p.price_max * 1.15) : null,
              },
      },
      {
        field: 'keywords',
        apply: (p) => (p.keywords ? { ...p, keywords: '' } : null),
      },
      {
        // Last resort: any size. Ranking still sorts by closeness to the
        // requested area, so the most similar size comes first ("algo parecido").
        field: 'area_any',
        apply: (p) =>
          p.area_min === null && p.area_max === null
            ? null
            : { ...p, area_min: null, area_max: null },
      },
    ];

    const run = async (plan: AssistantSearchPlan) => {
      const rows = await this.fetchAssistantCandidates(c, near, plan);
      return this.rankAssistantRows(rows, c, near && { ...near, radius_km: plan.radius_km! }, areaTarget, limit);
    };

    let plan = initial;
    let hits = await run(plan);
    const relaxedFields: string[] = [];
    for (const step of relaxSteps) {
      if (hits.length > 0) break;
      const next = step.apply(plan);
      if (!next) continue;
      plan = next;
      relaxedFields.push(step.field);
      hits = await run(plan);
    }

    return { hits, relaxed: relaxedFields.length > 0, relaxed_fields: relaxedFields };
  }

  private async fetchAssistantCandidates(
    c: PropertySearchCriteria,
    near: { lat: number; lng: number } | null,
    plan: AssistantSearchPlan,
  ): Promise<AssistantSearchRow[]> {
    const supabase = this.supabaseConfig.getAdminClient();

    let query = supabase
      .from('properties')
      .select(ASSISTANT_SEARCH_COLUMNS)
      .eq('status', 'PUBLICADO');

    if (c.type) query = query.eq('type', c.type);
    if (c.operation) {
      const ops = operationsMatching(c.operation);
      query = ops.length > 1 ? query.in('operation', ops) : query.eq('operation', ops[0]);
    }

    const area = rangeWithFallbackFilter('area_built', 'area_total', plan.area_min, plan.area_max);
    if (area) query = query.or(area);

    const priceColumn = priceColumnFor(c.operation);
    if (priceColumn) {
      const price = rangeWithFallbackFilter(priceColumn, 'price', plan.price_min, plan.price_max);
      if (price) query = query.or(price);
    } else {
      if (plan.price_min !== null) query = query.gte('price', plan.price_min);
      if (plan.price_max !== null) query = query.lte('price', plan.price_max);
    }

    const bedrooms = positive(c.bedrooms_min);
    const bathrooms = positive(c.bathrooms_min);
    const parking = positive(c.parking_min);
    if (bedrooms !== null) query = query.gte('bedrooms', bedrooms);
    if (bathrooms !== null) query = query.gte('bathrooms', bathrooms);
    if (parking !== null) query = query.gte('parking_spaces', parking);

    if (plan.keywords) {
      // search_vector is built with the Spanish configuration (migration 001).
      query = query.textSearch('search_vector', plan.keywords, {
        type: 'websearch',
        config: 'spanish',
      });
    }

    const city = accentInsensitive(sanitizeSearchText(c.city, 100));
    const state = accentInsensitive(sanitizeSearchText(c.state, 100));
    const neighborhood = accentInsensitive(sanitizeSearchText(c.neighborhood, 100));

    if (near && plan.radius_km !== null) {
      const dLat = plan.radius_km / 111.32;
      const dLng = plan.radius_km / (111.32 * Math.max(Math.cos((near.lat * Math.PI) / 180), 0.01));
      const box = [
        `latitude.gte.${near.lat - dLat}`,
        `latitude.lte.${near.lat + dLat}`,
        `longitude.gte.${near.lng - dLng}`,
        `longitude.lte.${near.lng + dLng}`,
      ].join(',');
      if (city || neighborhood) {
        // Coordinate-less listings matching the text, as a lower-priority tier.
        const text = [
          city ? `city.ilike."*${city}*"` : null,
          state ? `state.ilike."*${state}*"` : null,
          neighborhood ? `neighborhood.ilike."*${neighborhood}*"` : null,
        ]
          .filter(Boolean)
          .join(',');
        query = query.or(`and(${box}),and(or(latitude.is.null,longitude.is.null),${text})`);
      } else {
        query = query.or(`and(${box})`);
      }
    } else {
      if (city) query = query.ilike('city', `%${city}%`);
      if (state) query = query.ilike('state', `%${state}%`);
      if (neighborhood) query = query.ilike('neighborhood', `%${neighborhood}%`);
    }

    const { data, error } = await query
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(ASSISTANT_CANDIDATE_LIMIT);

    if (error) {
      this.logger.error(`Assistant property search failed: ${error.message}`);
      throw error;
    }

    return (data ?? []) as unknown as AssistantSearchRow[];
  }

  private rankAssistantRows(
    rows: AssistantSearchRow[],
    c: PropertySearchCriteria,
    near: { lat: number; lng: number; radius_km: number } | null,
    areaTarget: number | null,
    limit: number,
  ): PropertySearchHit[] {
    const priceColumn = priceColumnFor(c.operation);

    const scored = rows.flatMap((row, order) => {
      const lat = toNum(row.latitude);
      const lng = toNum(row.longitude);
      let distance: number | null = null;
      if (near && lat !== null && lng !== null) {
        distance = haversineKm(near.lat, near.lng, lat, lng);
        // The bounding box over-fetches its corners.
        if (distance > near.radius_km) return [];
      }
      const area = toNum(row.area_built) ?? toNum(row.area_total);
      return [{ row, order, lat, lng, distance, area }];
    });

    if (near) {
      // Geo hits by distance; coordinate-less text matches after, newest first.
      scored.sort((a, b) => {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        if (a.distance !== null) return -1;
        if (b.distance !== null) return 1;
        return a.order - b.order;
      });
    } else if (areaTarget !== null) {
      scored.sort((a, b) => {
        if (a.area !== null && b.area !== null) {
          return Math.abs(a.area - areaTarget) - Math.abs(b.area - areaTarget) || a.order - b.order;
        }
        if (a.area !== null) return -1;
        if (b.area !== null) return 1;
        return a.order - b.order;
      });
    }
    // Otherwise keep the database order: newest published first.

    return scored.slice(0, limit).map(({ row, lat, lng, distance, area }) => {
      const hideAddress = row.show_address === false;
      const price =
        row.show_price === false
          ? null
          : (priceColumn ? toNum(row[priceColumn]) : null) ?? toNum(row.price);
      return {
        id: row.id,
        title: row.title,
        type: row.type,
        operation: row.operation,
        price,
        currency: row.currency,
        area_m2: area,
        bedrooms: toNum(row.bedrooms),
        bathrooms: toNum(row.bathrooms),
        parking_spaces: toNum(row.parking_spaces),
        neighborhood: row.neighborhood ?? null,
        city: row.city,
        state: row.state,
        latitude: hideAddress ? null : lat,
        longitude: hideAddress ? null : lng,
        // Hidden addresses get a coarse (whole-km) distance so it cannot pin the spot.
        distance_km:
          distance === null
            ? null
            : hideAddress
              ? Math.max(1, Math.ceil(distance))
              : Math.round(distance * 10) / 10,
        featured_image_url: row.featured_image_url ?? null,
        url_path: `/propiedades/${row.id}`,
      };
    });
  }
}
