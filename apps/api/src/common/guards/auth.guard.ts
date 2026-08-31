import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseConfigService } from '../../config/supabase.config';
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
} from '../constants/account-status';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseConfig: SupabaseConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    let user: { id: string } | null = null;
    try {
      // Validate the JWT using Supabase's auth.getUser()
      const adminClient = this.supabaseConfig.getAdminClient();
      const { data, error } = await adminClient.auth.getUser(token);

      if (error || !data?.user) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      user = data.user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Auth validation failed', error);
      throw new UnauthorizedException('Authentication failed');
    }

    // Attach user and access token to the request for downstream use
    request.user = user;
    request.accessToken = token;

    // BH-04: `is_active` used to be written by the admin panel and read by
    // nobody, so deactivating an account did nothing at all. The check lives
    // here — not in RolesGuard — because RolesGuard short-circuits on routes
    // without @Roles(), which is most of them. A valid Supabase token is not
    // enough: the account must still be enabled on our side.
    await this.assertAccountEnabled(request, user!.id);

    return true;
  }

  /**
   * Loads role + is_active once per request and caches them so RolesGuard
   * (and any downstream code) does not pay for a second round-trip.
   *
   * A missing profile row is NOT a denial: `POST /profiles` exists precisely
   * to create it right after signup, and blocking here would make signup
   * unrecoverable. RolesGuard still denies any @Roles() route in that case.
   */
  private async assertAccountEnabled(
    request: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    let profile: { role: string; is_active: boolean } | null = null;
    try {
      const adminClient = this.supabaseConfig.getAdminClient();
      const { data, error } = await adminClient
        .from('profiles')
        .select('role, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        this.logger.error(
          `Failed to load profile for ${userId}: ${error.message}`,
        );
        // Fail closed: we cannot prove the account is enabled.
        throw new ForbiddenException({
          code: 'PROFILE_LOOKUP_FAILED',
          message:
            'No pudimos verificar el estado de tu cuenta. Inténtalo de nuevo en unos momentos.',
        });
      }
      profile = (data as { role: string; is_active: boolean } | null) ?? null;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('Profile lookup failed', error);
      throw new ForbiddenException({
        code: 'PROFILE_LOOKUP_FAILED',
        message:
          'No pudimos verificar el estado de tu cuenta. Inténtalo de nuevo en unos momentos.',
      });
    }

    if (!profile) {
      request.userRole = null;
      request.userProfile = null;
      return;
    }

    if (profile.is_active === false) {
      this.logger.warn(`Blocked request from deactivated account ${userId}`);
      throw new ForbiddenException({
        code: ACCOUNT_DISABLED_CODE,
        message: ACCOUNT_DISABLED_MESSAGE,
      });
    }

    request.userRole = profile.role;
    request.userProfile = profile;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authorization = request.headers?.authorization;
    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
