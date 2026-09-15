/**
 * Onboarding guiado para usuarios nuevos.
 *
 * El estado vive en `profiles.onboarding` (jsonb, migración 035) y se espeja
 * en localStorage para que el primer render no parpadee y para seguir
 * funcionando si la columna aún no existe en la base.
 */

/** Recorridos disponibles. Cada uno se muestra una sola vez por usuario. */
export type TourId = "dashboard" | "nueva-propiedad" | "solicitar-brc" | "expedientes";

export interface OnboardingState {
  /** Versión del esquema; permite reiniciar a todos si cambia el flujo. */
  v: 1;
  /** El modal de bienvenida ya se mostró (o se descartó). */
  welcomeSeen: boolean;
  /** Fecha ISO en que cada recorrido se completó o se saltó. */
  tours: Partial<Record<TourId, string>>;
  /** El usuario ocultó la tarjeta "Primeros pasos" del dashboard. */
  checklistDismissedAt: string | null;
}

export const ONBOARDING_VERSION = 1 as const;

export const EMPTY_ONBOARDING: OnboardingState = {
  v: ONBOARDING_VERSION,
  welcomeSeen: false,
  tours: {},
  checklistDismissedAt: null,
};

/** Roles que publican propiedades y piden certificación: reciben el onboarding. */
export const ONBOARDING_ROLES = ["VENDEDOR", "BROKER", "INMOBILIARIA"] as const;
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

export function isOnboardingRole(role: string | undefined | null): role is OnboardingRole {
  return (ONBOARDING_ROLES as readonly string[]).includes(role ?? "");
}

/** Normaliza lo que venga de la base o de localStorage a un estado válido. */
export function parseOnboarding(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ONBOARDING, tours: {} };
  const o = raw as Record<string, unknown>;
  if (o.v !== ONBOARDING_VERSION) return { ...EMPTY_ONBOARDING, tours: {} };
  const tours: OnboardingState["tours"] = {};
  if (o.tours && typeof o.tours === "object") {
    for (const [k, v] of Object.entries(o.tours as Record<string, unknown>)) {
      if (typeof v === "string") tours[k as TourId] = v;
    }
  }
  return {
    v: ONBOARDING_VERSION,
    welcomeSeen: o.welcomeSeen === true,
    tours,
    checklistDismissedAt:
      typeof o.checklistDismissedAt === "string" ? o.checklistDismissedAt : null,
  };
}

/** Un paso del recorrido. `target` es el valor de `data-tour` del elemento a resaltar. */
export interface TourStep {
  /** Sin target el paso se muestra centrado (introducción / cierre). */
  target?: string;
  title: string;
  body: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  /** Texto del botón de avance en este paso (por defecto "Siguiente"). */
  nextLabel?: string;
  /** Si el paso final tiene una acción (p.ej. ir a publicar), se navega aquí. */
  ctaHref?: string;
  /**
   * Alternativa a `ctaHref`: en vez de navegar, el CTA dispara este evento en
   * `window` para que la pantalla actual reaccione (p.ej. abrir un modal).
   */
  ctaEvent?: string;
  ctaLabel?: string;
}
