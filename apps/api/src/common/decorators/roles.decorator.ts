import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts access to users with specified roles.
 * Usage: @Roles('admin', 'agent') on a controller method or class.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
