import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import {
  DEFAULT_SIGNUP_ROLE,
  PROTECTED_PROFILE_FIELDS,
} from '../../common/constants/roles';

import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';

export class CreateProfileDto {
  @IsUUID() id!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() @Length(0, 100) first_name?: string;
  @IsOptional() @IsString() @Length(0, 100) last_name?: string;
  @IsOptional() @IsString() @Matches(/^[+()\d\s-]{6,30}$/) phone?: string;
  @IsOptional() @IsUrl({ require_tld: false }) avatar_url?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(0, 100) first_name?: string;
  @IsOptional() @IsString() @Length(0, 100) last_name?: string;
  @IsOptional() @IsString() @Matches(/^[+()\d\s-]{6,30}$/) phone?: string;
  @IsOptional() @IsUrl({ require_tld: false }) avatar_url?: string;
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


/**
 * Rejects any attempt to write a field only an admin may change.
 *
 * `forbidNonWhitelisted` in the global ValidationPipe already returns 400 for
 * unknown properties, but that pipe is configured in main.ts and can be
 * loosened by anyone; a privilege escalation must not depend on a global
 * setting living in another file.
 */
export function assertNoProtectedProfileFields(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const keys = Object.keys(payload as Record<string, unknown>);
  const offending = keys.filter((k) =>
    (PROTECTED_PROFILE_FIELDS as readonly string[]).includes(k),
  );
  if (offending.length > 0) {
    throw new ForbiddenException(
      `No puedes modificar estos campos desde tu perfil: ${offending.join(', ')}. Solicítalo a un administrador.`,
    );
  }
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
        email: dto.email,
        first_name: dto.first_name ?? null,
        last_name: dto.last_name ?? null,
        phone: dto.phone ?? null,
        avatar_url: dto.avatar_url ?? null,
        // BH-01: the role is decided here, never by the caller. The DTO has
        // no `role` field and `forbidNonWhitelisted` already rejects extras,
        // but writing it explicitly means a future DTO change cannot silently
        // reopen the hole.
        role: DEFAULT_SIGNUP_ROLE,
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
    // BH-01: this service writes with the service_role client, which bypasses
    // RLS — the "users cannot change their own role" policy in
    // 003_security_hardening.sql does not protect this path at all. The
    // allowlist below is therefore the only thing standing between a user and
    // `role: 'ADMIN'`, so it is enforced explicitly rather than implied by the
    // shape of the DTO.
    assertNoProtectedProfileFields(dto);

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

  /**
   * Permanently delete a user account and all associated data.
   * Uses the admin client to delete from auth.users (cascades to profiles and all related data).
   */
  async deleteAccount(userId: string): Promise<{ message: string }> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      this.logger.error(`Failed to delete account ${userId}: ${error.message}`);
      throw new InternalServerErrorException('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
    }

    this.logger.log(`Account ${userId} deleted successfully`);
    return { message: 'Cuenta eliminada exitosamente.' };
  }
}
