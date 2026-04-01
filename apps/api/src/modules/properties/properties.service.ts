import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import { randomBytes } from 'crypto';

// ────────────────────────────────────────────────────────────
// DTOs
// ────────────────────────────────────────────────────────────

export interface CreatePropertyDto {
  company_id?: string;
  title: string;
  description?: string;
  type: string;
  operation: string;
  price: number;
  currency?: string;
  accepts_crypto?: boolean;
  area_total?: number;
  area_built?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  floors?: number;
  address_line?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  amenities?: unknown[];
  featured_image_url?: string;
}

export interface UpdatePropertyDto {
  company_id?: string;
  title?: string;
  description?: string;
  type?: string;
  operation?: string;
  price?: number;
  currency?: string;
  accepts_crypto?: boolean;
  area_total?: number;
  area_built?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  floors?: number;
  address_line?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  amenities?: unknown[];
  featured_image_url?: string;
}

export interface PropertyFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  operation?: string;
  status?: string;
  city?: string;
  state?: string;
  price_min?: number;
  price_max?: number;
  bedrooms?: number;
  brc_status?: string;
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
        price: dto.price,
        currency: dto.currency ?? 'MXN',
        accepts_crypto: dto.accepts_crypto ?? false,
        area_total: dto.area_total ?? null,
        area_built: dto.area_built ?? null,
        bedrooms: dto.bedrooms ?? null,
        bathrooms: dto.bathrooms ?? null,
        parking_spaces: dto.parking_spaces ?? null,
        floors: dto.floors ?? null,
        address_line: dto.address_line ?? null,
        neighborhood: dto.neighborhood ?? null,
        city: dto.city,
        state: dto.state,
        zip_code: dto.zip_code ?? null,
        country: dto.country ?? 'MX',
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        amenities: dto.amenities ?? [],
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

    // Full-text search via the search_vector column
    if (filters.search) {
      const tsQuery = filters.search
        .trim()
        .split(/\s+/)
        .map((w) => `'${w}'`)
        .join(' & ');
      query = query.textSearch('search_vector', tsQuery);
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
      'bathrooms',
      'parking_spaces',
      'floors',
      'address_line',
      'neighborhood',
      'city',
      'state',
      'zip_code',
      'country',
      'latitude',
      'longitude',
      'amenities',
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
}
