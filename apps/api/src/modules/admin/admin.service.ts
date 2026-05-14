import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsIn,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { SupabaseConfigService } from '../../config/supabase.config';

const USER_ROLES = ['ADMIN', 'INMOBILIARIA', 'BROKER', 'VENDEDOR', 'COMPRADOR', 'NOTARIO', 'OPERADOR_BRC'] as const;

export class UpdateUserRoleDto {
  @IsString() @IsIn(USER_ROLES as unknown as string[]) role!: string;
}

export class UpdateUserActiveDto {
  @IsBoolean() is_active!: boolean;
}

export class VerifyNotaryDto {
  @IsBoolean() verified!: boolean;
}

export class AssignExpedienteDto {
  @IsOptional() @IsUUID() notary_id?: string | null;
  @IsOptional() @IsUUID() operator_id?: string | null;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  async updateUserRole(userId: string, role: string) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id, role')
      .single();

    if (error) {
      this.logger.error(`Failed to update role for ${userId}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
    if (!data) throw new NotFoundException('Usuario no encontrado');
    return data;
  }

  async updateUserActive(userId: string, isActive: boolean) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select('id, is_active')
      .single();

    if (error) {
      this.logger.error(`Failed to set is_active for ${userId}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
    if (!data) throw new NotFoundException('Usuario no encontrado');
    return data;
  }

  async verifyNotary(profileId: string, verified: boolean) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('notary_profiles')
      .update({ is_verified: verified })
      .eq('profile_id', profileId)
      .select('id, profile_id, is_verified')
      .single();

    if (error) {
      this.logger.error(`Failed to verify notary ${profileId}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
    if (!data) throw new NotFoundException('Notario no encontrado');
    return data;
  }

  async assignExpediente(
    expedienteId: string,
    notaryId: string | null | undefined,
    operatorId: string | null | undefined,
  ) {
    const updates: Record<string, string | null> = {};
    if (notaryId !== undefined) updates.assigned_notary_id = notaryId;
    if (operatorId !== undefined) updates.assigned_operator_id = operatorId;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('Debe enviar notary_id o operator_id');
    }

    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('brc_expedientes')
      .update(updates)
      .eq('id', expedienteId)
      .select('id, assigned_notary_id, assigned_operator_id')
      .single();

    if (error) {
      this.logger.error(`Failed to assign expediente ${expedienteId}: ${error.message}`);
      throw new BadRequestException(error.message);
    }
    if (!data) throw new NotFoundException('Expediente no encontrado');
    return data;
  }
}
