/**
 * Single source of truth for the role taxonomy shared by guards, DTOs and
 * the admin module.
 *
 * BH-01: the previous design let the browser pick any role at signup — the
 * value travelled in `user_metadata` and was written straight into
 * `profiles.role`. The split below is the code-side half of the fix; the
 * RLS half lives in `packages/supabase/migrations/031_security_rbac_hardening.sql`.
 * Both layers must agree, so keep the two lists in sync.
 */

/** Roles a person may give themselves through public signup. */
export const SELF_ASSIGNABLE_ROLES = [
  'COMPRADOR',
  'VENDEDOR',
  'BROKER',
  'INMOBILIARIA',
] as const;

/** Roles that only an existing ADMIN may grant. */
export const PRIVILEGED_ROLES = ['NOTARIO', 'OPERADOR_BRC', 'ADMIN'] as const;

export const ALL_ROLES = [
  ...SELF_ASSIGNABLE_ROLES,
  ...PRIVILEGED_ROLES,
] as const;

export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];
export type UserRole = (typeof ALL_ROLES)[number];

/** Role handed to every public signup, whatever the browser asked for. */
export const DEFAULT_SIGNUP_ROLE: SelfAssignableRole = 'COMPRADOR';

export function isPrivilegedRole(role: unknown): role is PrivilegedRole {
  return (
    typeof role === 'string' &&
    (PRIVILEGED_ROLES as readonly string[]).includes(role)
  );
}

export function isSelfAssignableRole(role: unknown): role is SelfAssignableRole {
  return (
    typeof role === 'string' &&
    (SELF_ASSIGNABLE_ROLES as readonly string[]).includes(role)
  );
}

export function isKnownRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (ALL_ROLES as readonly string[]).includes(role);
}

/**
 * Normalises whatever the client sent into a role we are willing to persist
 * at signup time. Anything privileged, unknown or missing collapses to the
 * default role — the request is never rejected, because a bogus role is an
 * attack, not a user error, and telling the attacker apart from a stale
 * client is not worth an extra failure mode.
 */
export function sanitizeSignupRole(requested: unknown): SelfAssignableRole {
  const normalized =
    typeof requested === 'string' ? requested.trim().toUpperCase() : '';
  return isSelfAssignableRole(normalized) ? normalized : DEFAULT_SIGNUP_ROLE;
}

/** Fields nobody may set on themselves through a profile write. */
export const PROTECTED_PROFILE_FIELDS = [
  'role',
  'is_active',
  'kyc_status',
  'company_id',
  'id',
  'email',
] as const;
