import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';

export interface CreateProfileDto {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface UpdateProfileDto {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface Profile {
  id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  /**
   * Get a profile by user ID.
   */
  async getProfileById(userId: string): Promise<Profile> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      this.logger.warn(`Profile not found for user ${userId}`);
      throw new NotFoundException('Profile not found');
    }

    return data as Profile;
  }

  /**
   * Create a new profile (typically called right after signup).
   */
  async createProfile(dto: CreateProfileDto): Promise<Profile> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: dto.id,
        first_name: dto.first_name ?? null,
        last_name: dto.last_name ?? null,
        phone: dto.phone ?? null,
        avatar_url: dto.avatar_url ?? null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to create profile: ${error.message}`);

      if (error.code === '23505') {
        throw new ConflictException('Profile already exists for this user');
      }

      throw error;
    }

    return data as Profile;
  }

  /**
   * Update an existing profile by user ID.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Profile> {
    const supabase = this.supabaseConfig.getAdminClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
    if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatar_url !== undefined) updateData.avatar_url = dto.avatar_url;

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update profile for user ${userId}: ${error?.message}`,
      );
      throw new NotFoundException('Profile not found');
    }

    return data as Profile;
  }
}
