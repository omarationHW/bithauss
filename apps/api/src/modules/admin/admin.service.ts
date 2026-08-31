import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IsString,
  IsIn,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { SupabaseConfigService } from '../../config/supabase.config';
import { ALL_ROLES, isPrivilegedRole } from '../../common/constants/roles';

const USER_ROLES = ALL_ROLES;

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

  /**
   * BH-01: granting a role is the single most sensitive mutation in the
   * platform, so it carries three extra rules on top of @Roles('ADMIN'):
   *
   *  1. Nobody changes their own role. Not even an admin — it removes the
   *     "two people were involved" property from every privilege change and
   *     is the classic way a compromised admin session becomes permanent.
   *  2. Promoting to NOTARIO requires a verified `notary_profiles` row. The
   *     role by itself means nothing if the notary was never validated, and
   *     RolesGuard would deny the user anyway — better to say so here.
   *  3. Every grant of a privileged role is logged at warn level.
   */
  async updateUserRole(userId: string, role: string, actorId?: string) {
    if (actorId && actorId === userId) {
      throw new ForbiddenException(
        'No puedes cambiar tu propio rol. Pídeselo a otro administrador.',
      );
    }

    const supabase = this.supabaseConfig.getAdminClient();

    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (targetError) {
      this.logger.error(
        `Failed to read profile ${userId}: ${targetError.message}`,
      );
      throw new BadRequestException(
        'No se pudo leer el perfil del usuario. Inténtalo de nuevo.',
      );
    }
    if (!target) throw new NotFoundException('Usuario no encontrado');

    if (role === 'NOTARIO') {
      const { data: notary } = await supabase
        .from('notary_profiles')
        .select('is_verified')
        .eq('profile_id', userId)
        .maybeSingle();

      if (!notary) {
        throw new BadRequestException(
          'Este usuario no tiene una solicitud notarial registrada. Pídele que complete su alta de notario antes de asignarle el rol.',
        );
      }
      if ((notary as { is_verified?: boolean }).is_verified !== true) {
        throw new BadRequestException(
          'Primero verifica la notaría (PATCH /admin/notaries/:profileId/verify) y después asigna el rol NOTARIO.',
        );
      }
    }

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

    if (isPrivilegedRole(role)) {
      this.logger.warn(
        `PRIVILEGED ROLE GRANT: ${actorId ?? 'unknown-admin'} set ${userId} from "${(target as { role: string }).role}" to "${role}"`,
      );
    }
    return data;
  }

  /**
   * BH-04: writing the flag was never the problem — nothing read it. Now that
   * AuthGuard denies deactivated accounts, the remaining gap is the live
   * session: Supabase keeps refreshing the access token from a refresh token
   * that outlives the deactivation. `signOut(userId, 'global')` revokes it so
   * the user is actually pushed out instead of merely flagged.
   */
  async updateUserActive(userId: string, isActive: boolean, actorId?: string) {
    if (actorId && actorId === userId && !isActive) {
      throw new ForbiddenException(
        'No puedes desactivar tu propia cuenta de administrador.',
      );
    }

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

    if (!isActive) {
      await this.revokeSessions(userId);
    }

    return data;
  }

  /** Best-effort session revocation; never blocks the deactivation itself. */
  private async revokeSessions(userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();
    try {
      const admin = supabase.auth.admin as unknown as {
        signOut?: (id: string, scope?: string) => Promise<{ error?: unknown }>;
      };
      if (typeof admin.signOut !== 'function') {
        this.logger.warn(
          `auth.admin.signOut unavailable; sessions for ${userId} were not revoked`,
        );
        return;
      }
      const { error } = await admin.signOut(userId, 'global');
      if (error) {
        this.logger.error(
          `Failed to revoke sessions for ${userId}: ${String(error)}`,
        );
        return;
      }
      this.logger.log(`Revoked all sessions for deactivated user ${userId}`);
    } catch (err) {
      this.logger.error(`Session revocation threw for ${userId}`, err as Error);
    }
  }

  /**
   * BH-01: verifying a notary is the moment BitHauss vouches for them, so it
   * is also the moment the NOTARIO role is granted — one admin action instead
   * of two, which removes the window where a "verified" notary still holds a
   * neutral role (or, worse, a NOTARIO role that was never verified).
   * Un-verifying revokes the role back to COMPRADOR for the same reason.
   */
  async verifyNotary(profileId: string, verified: boolean, actorId?: string) {
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', profileId)
      .maybeSingle();
    const currentRole = (profile as { role?: string } | null)?.role;

    if (verified && currentRole && currentRole !== 'NOTARIO' && currentRole !== 'ADMIN') {
      await supabase.from('profiles').update({ role: 'NOTARIO' }).eq('id', profileId);
      this.logger.warn(
        `PRIVILEGED ROLE GRANT: ${actorId ?? 'unknown-admin'} verified notary ${profileId} (role ${currentRole} -> NOTARIO)`,
      );
    }

    if (!verified && currentRole === 'NOTARIO') {
      await supabase.from('profiles').update({ role: 'COMPRADOR' }).eq('id', profileId);
      this.logger.warn(
        `NOTARY REVOKED: ${actorId ?? 'unknown-admin'} un-verified ${profileId} (role NOTARIO -> COMPRADOR)`,
      );
      await this.revokeSessions(profileId);
    }

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

    // BH-01: the assignment screen used to list every NOTARIO regardless of
    // `is_verified`. One mis-click was enough to put an unverified notary on
    // a real expediente, so the check moved server-side where it cannot be
    // skipped by a stale UI.
    if (notaryId) {
      const { data: notary } = await supabase
        .from('notary_profiles')
        .select('is_verified')
        .eq('profile_id', notaryId)
        .maybeSingle();
      if (!notary || (notary as { is_verified?: boolean }).is_verified !== true) {
        throw new BadRequestException(
          'Solo puedes asignar notarios verificados. Verifica primero la notaría desde el panel de administración.',
        );
      }
    }

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
