/**
 * Role taxonomy for the browser (BH-01).
 *
 * The registration form used to send `selectedRole.toUpperCase()` straight
 * into `profiles.role`, so anyone could pick "Notario" and instantly hold the
 * role the whole product's trust model depends on. The browser is not a place
 * where authorisation decisions can be made, so the only thing it is allowed
 * to produce now is a self-assignable role; anything else becomes a *request*
 * an administrator has to approve.
 *
 * Mirror of `apps/api/src/common/constants/roles.ts` and of the RLS policy in
 * `packages/supabase/migrations/031_security_rbac_hardening.sql`. All three
 * must list the same roles.
 */

export const SELF_ASSIGNABLE_ROLES = [
  "COMPRADOR",
  "VENDEDOR",
  "BROKER",
  "INMOBILIARIA",
] as const;

export const PRIVILEGED_ROLES = ["NOTARIO", "OPERADOR_BRC", "ADMIN"] as const;

export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];
export type UserRole = SelfAssignableRole | PrivilegedRole;

export const DEFAULT_SIGNUP_ROLE: SelfAssignableRole = "COMPRADOR";

export function isPrivilegedRole(role: unknown): role is PrivilegedRole {
  return (
    typeof role === "string" &&
    (PRIVILEGED_ROLES as readonly string[]).includes(role.trim().toUpperCase())
  );
}

export function isSelfAssignableRole(role: unknown): role is SelfAssignableRole {
  return (
    typeof role === "string" &&
    (SELF_ASSIGNABLE_ROLES as readonly string[]).includes(
      role.trim().toUpperCase(),
    )
  );
}

/**
 * What the signup form is allowed to write into `profiles.role`.
 *
 * A privileged (or unknown) selection collapses to the default role instead of
 * throwing: the user still gets an account, and the privileged part of their
 * request is handled separately as an application. Returning a value rather
 * than an error also means a stale cached bundle cannot lock anybody out.
 */
export function resolveSignupRole(selection: unknown): SelfAssignableRole {
  const normalized =
    typeof selection === "string" ? selection.trim().toUpperCase() : "";
  return isSelfAssignableRole(normalized) ? normalized : DEFAULT_SIGNUP_ROLE;
}

/** Selections that create an application instead of granting a role. */
export type RoleApplication = "NOTARIO";

/**
 * True when the signup selection is an application for a privileged role
 * rather than a role the user simply gets.
 */
export function isRoleApplication(selection: unknown): selection is string {
  return isPrivilegedRole(selection);
}

/** Copy shown after a notary applies. Kept here so the test can assert it. */
export const NOTARY_APPLICATION_NOTICE =
  "Tu solicitud de alta como notario quedó registrada. Un administrador de BitHauss verificará tu número de notaría antes de habilitarte para operar expedientes; mientras tanto tu cuenta funciona con el perfil estándar.";
