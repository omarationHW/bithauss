/**
 * Reglas puras sobre el progreso del usuario en el flujo de onboarding.
 * Sin dependencias de React ni Supabase para poder probarlas en aislamiento.
 */

export interface ProfileFields {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

/**
 * "Perfil completo" = exactamente lo que la página /dashboard/perfil guarda en
 * `profiles`: nombre, apellido y teléfono con contenido (no solo espacios).
 */
export function isProfileComplete(p: ProfileFields | null | undefined): boolean {
  if (!p) return false;
  const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;
  return filled(p.first_name) && filled(p.last_name) && filled(p.phone);
}
