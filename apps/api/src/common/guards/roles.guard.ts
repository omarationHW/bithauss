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
    let userRole: string | null = request.userRole ?? null;
    if (!userRole) {
      const adminClient = this.supabaseConfig.getAdminClient();
      const { data, error } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        this.logger.warn(`No profile found for user ${user.id}; denying`);
        throw new ForbiddenException('Profile not found');
      }
      userRole = data.role as string;
      request.userRole = userRole; // cache on the request for downstream
    }

    if (!requiredRoles.includes(userRole)) {
      this.logger.warn(
        `User ${user.id} with role "${userRole}" denied access. Required: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        'You do not have the required permissions to access this resource',
      );
    }

    return true;
  }
}
