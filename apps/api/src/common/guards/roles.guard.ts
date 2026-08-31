import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseConfigService } from '../../config/supabase.config';
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
  NOTARY_NOT_VERIFIED_CODE,
  NOTARY_NOT_VERIFIED_MESSAGE,
} from '../constants/account-status';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseConfig: SupabaseConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // SECURITY: never trust user_metadata.role (the user can edit it).
    // Read role from the profiles table — single source of truth.
    // AuthGuard normally primes request.userRole; the fallback keeps this
    // guard usable in isolation (unit tests, custom guard ordering).
    let userRole: string | null = request.userRole ?? null;
    if (!userRole) {
      const adminClient = this.supabaseConfig.getAdminClient();
      const { data, error } = await adminClient
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        this.logger.warn(`No profile found for user ${user.id}; denying`);
        throw new ForbiddenException('Profile not found');
      }
      // BH-04: defence in depth — AuthGuard already rejects deactivated
      // accounts, but this guard must not become the hole if the guard order
      // ever changes.
      if ((data as { is_active?: boolean }).is_active === false) {
        throw new ForbiddenException({
          code: ACCOUNT_DISABLED_CODE,
          message: ACCOUNT_DISABLED_MESSAGE,
        });
      }
      userRole = (data as { role: string }).role;
      request.userRole = userRole; // cache on the request for downstream
    }

    if (!requiredRoles.includes(userRole)) {
      this.logger.warn(
        `User ${user.id} with role "${userRole}" denied access. Required: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        'No tienes los permisos necesarios para acceder a este recurso.',
      );
    }

    // BH-01: holding the NOTARIO role is not enough — the notary must have
    // been verified by an admin. `notary_profiles.is_verified` existed since
    // day one and nothing ever read it, which meant an unverified (or
    // outright fake) notary passed every @Roles('NOTARIO') endpoint.
    if (userRole === 'NOTARIO') {
      await this.assertVerifiedNotary(request, user.id);
    }

    return true;
  }

  private async assertVerifiedNotary(
    request: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    if (request.notaryVerified === true) return;

    const adminClient = this.supabaseConfig.getAdminClient();
    const { data, error } = await adminClient
      .from('notary_profiles')
      .select('is_verified')
      .eq('profile_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Notary verification lookup failed for ${userId}: ${error.message}`,
      );
      // Fail closed — an unverifiable notary must not act as one.
      throw new ForbiddenException({
        code: NOTARY_NOT_VERIFIED_CODE,
        message: NOTARY_NOT_VERIFIED_MESSAGE,
      });
    }

    if (!data || (data as { is_verified?: boolean }).is_verified !== true) {
      this.logger.warn(`Unverified NOTARIO ${userId} denied access`);
      throw new ForbiddenException({
        code: NOTARY_NOT_VERIFIED_CODE,
        message: NOTARY_NOT_VERIFIED_MESSAGE,
      });
    }

    request.notaryVerified = true;
  }
}
