// ──────────────────────────────────────────────────────────────
// BitHauss — Catálogo de Membresías (Módulo Membresías 2024 · 2026 V1)
// ──────────────────────────────────────────────────────────────
// Single source of truth for the six tiers × four contract plans.
// Every number here is transcribed verbatim from the PDF
// "BitHauss Módulo Membresías 2024. 2026 V1" (precios a Julio 2024,
// elaboró: Renato Torres), pages 4-10.
//
// Why literal unions instead of the enums in @bithauss/types:
// @bithauss/config has no dependency on @bithauss/types (see its
// package.json — it is a zero-dependency leaf package, and adding the edge
// would create a cycle with validators). TypeScript string-enum members are
// assignable to their matching string-literal type, so `getPlan(
// MembershipTier.START)` type-checks against `MembershipTierKey` unchanged.
// ──────────────────────────────────────────────────────────────

export type MembershipTierKey =
  | 'START'
  | 'GROW'
  | 'BLUE'
  | 'GOLD'
  | 'BLACK'
  | 'PLATINO';

export type MembershipPeriodKey =
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'ANUAL_ANTICIPADO';

/**
 * IVA rate applied on top of every published membership price.
 *
 * TODO(unify): a parallel effort owns the BRC price/IVA/Stripe-fee constants
 * in `packages/config/src/constants.ts` + `apps/web/src/lib/brc-pricing.ts`.
 * This constant is deliberately local so the two workstreams do not collide;
 * once BRC lands, delete this and import the shared one.
 */
export const MEMBERSHIP_IVA_RATE = 0.16;

/** Prices in the catalogue are quoted before IVA, in MXN. */
export const MEMBERSHIP_CURRENCY = 'MXN';

/** A2 — free trial: 7 natural days, card on file, auto-charges on expiry. */
export const MEMBERSHIP_TRIAL_DAYS = 7;
export const MEMBERSHIP_TRIAL_PROPERTY_LIMIT = 3;
export const MEMBERSHIP_TRIAL_CRM_SEATS = 1;
/** "1 cuenta para cursos de Formación Inmobiliaria vía Webinar". */
export const MEMBERSHIP_TRIAL_TRAINING_SEATS = 1;

/** Contract length in months, per period. ANUAL_ANTICIPADO is annual too. */
export const MEMBERSHIP_PERIOD_MONTHS: Record<MembershipPeriodKey, number> = {
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
  ANUAL_ANTICIPADO: 12,
};

export const MEMBERSHIP_PERIODS: MembershipPeriodKey[] = [
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
  'ANUAL_ANTICIPADO',
];

export const MEMBERSHIP_TIERS: MembershipTierKey[] = [
  'START',
  'GROW',
  'BLUE',
  'GOLD',
  'BLACK',
  'PLATINO',
];

/** Human label for each period, es-MX, as printed in the PDF. */
export const MEMBERSHIP_PERIOD_LABEL: Record<MembershipPeriodKey, string> = {
  TRIMESTRAL: 'Plan Trimestral',
  SEMESTRAL: 'Plan Semestral',
  ANUAL: 'Plan Anual',
  ANUAL_ANTICIPADO: 'Plan Anual · pago total al contratar',
};

export interface MembershipPeriodPricing {
  period: MembershipPeriodKey;
  /** Contract duration in months (A3). */
  months: number;
  /** Total contract price in MXN, before IVA. */
  total: number;
  /**
   * A4 — monthly direct-debit instalment for this plan, or null when the plan
   * is by definition a single up-front payment (ANUAL_ANTICIPADO).
   * Note the PDF quotes the *same* monthly amount for the 3/6/12 payment
   * plans of a tier, so `instalmentAmount * instalments !== total`: the
   * instalment scheme costs more than the single payment. That is intentional
   * and must be shown as-is.
   */
  instalmentAmount: number | null;
  /** Number of monthly charges (3 / 6 / 12), null for the single payment. */
  instalments: number | null;
  /** True only for the "precio especial - pago total al contratar" plan. */
  isPrepaidAnnual: boolean;
}

export interface MembershipTierDefinition {
  tier: MembershipTierKey;
  /** 1..6 — the number BitHauss prints next to the tier name. */
  level: number;
  /** Commercial name shown to the client, e.g. "1 START". */
  name: string;
  description: string;
  /** Properties the client may publish on the portal. */
  propertyLimit: number;
  /** CRM seats ("cuentas de acceso al CRM inmobiliario"). */
  crmSeats: number;
  /** Discount on BRC certificate issuance, as a percentage (0 = none). */
  brcDiscountPct: number;
  /** Discount on property video production, as a percentage (0 = none). */
  videoDiscountPct: number;
  /**
   * Legal-consultation tickets granted per contract. The PDF is explicit:
   * "Aplica únicamente pagando por anticipado el Plan Anual", so these are
   * only granted on ANUAL_ANTICIPADO — see `getLegalTickets`.
   */
  legalTickets: number;
  /** Red de Profesionales Inmobiliarios Certificados BitHauss. */
  certifiedProfessionalsNetwork: boolean;
  /** Red de Notarios con Convenio BitHauss. */
  notaryNetwork: boolean;
  /** Biblioteca Jurídica BitHauss (formatos inmobiliarios). */
  legalFormsLibrary: boolean;
  /**
   * A6 — only PLATINO may stack extra memberships to accumulate properties
   * and benefits. Every other tier must upgrade instead.
   */
  allowsStacking: boolean;
  plans: Record<MembershipPeriodKey, MembershipPeriodPricing>;
}

/**
 * Builds the four plans of a tier from the five numbers the PDF prints:
 * quarterly / half-yearly / annual totals, the discounted prepaid annual
 * price, and the single monthly instalment shared by the first three plans.
 */
function buildPlans(
  trimestral: number,
  semestral: number,
  anual: number,
  anualAnticipado: number,
  monthlyInstalment: number,
): Record<MembershipPeriodKey, MembershipPeriodPricing> {
  return {
    TRIMESTRAL: {
      period: 'TRIMESTRAL',
      months: 3,
      total: trimestral,
      instalmentAmount: monthlyInstalment,
      instalments: 3,
      isPrepaidAnnual: false,
    },
    SEMESTRAL: {
      period: 'SEMESTRAL',
      months: 6,
      total: semestral,
      instalmentAmount: monthlyInstalment,
      instalments: 6,
      isPrepaidAnnual: false,
    },
    ANUAL: {
      period: 'ANUAL',
      months: 12,
      total: anual,
      instalmentAmount: monthlyInstalment,
      instalments: 12,
      isPrepaidAnnual: false,
    },
    ANUAL_ANTICIPADO: {
      period: 'ANUAL_ANTICIPADO',
      months: 12,
      total: anualAnticipado,
      instalmentAmount: null,
      instalments: null,
      isPrepaidAnnual: true,
    },
  };
}

export const MEMBERSHIP_CATALOG: Record<
  MembershipTierKey,
  MembershipTierDefinition
> = {
  START: {
    tier: 'START',
    level: 1,
    name: '1 START',
    description:
      'Para quien empieza a publicar en el Portal Inmobiliario BitHauss.',
    propertyLimit: 50,
    crmSeats: 1,
    brcDiscountPct: 0,
    videoDiscountPct: 0,
    legalTickets: 0,
    certifiedProfessionalsNetwork: false,
    notaryNetwork: false,
    legalFormsLibrary: false,
    allowsStacking: false,
    plans: buildPlans(3_000, 6_000, 12_000, 10_000, 1_100),
  },
  GROW: {
    tier: 'GROW',
    level: 2,
    name: '2 GROW',
    description: 'Para brokers que ya operan cartera y necesitan más volumen.',
    propertyLimit: 75,
    crmSeats: 2,
    brcDiscountPct: 0,
    videoDiscountPct: 0,
    legalTickets: 0,
    certifiedProfessionalsNetwork: false,
    notaryNetwork: false,
    legalFormsLibrary: false,
    allowsStacking: false,
    plans: buildPlans(4_500, 9_000, 18_000, 15_000, 1_750),
  },
  BLUE: {
    tier: 'BLUE',
    level: 3,
    name: '3 BLUE',
    description: 'Para equipos pequeños con cartera en crecimiento.',
    propertyLimit: 150,
    crmSeats: 3,
    brcDiscountPct: 0,
    videoDiscountPct: 0,
    legalTickets: 0,
    certifiedProfessionalsNetwork: false,
    notaryNetwork: false,
    legalFormsLibrary: false,
    allowsStacking: false,
    plans: buildPlans(7_500, 15_000, 30_000, 25_000, 3_000),
  },
  GOLD: {
    tier: 'GOLD',
    level: 4,
    name: '4 GOLD',
    description:
      'Para inmobiliarias con equipo: descuentos en certificación BRC y videos.',
    propertyLimit: 300,
    crmSeats: 4,
    brcDiscountPct: 5,
    videoDiscountPct: 5,
    legalTickets: 0,
    certifiedProfessionalsNetwork: false,
    notaryNetwork: false,
    legalFormsLibrary: false,
    allowsStacking: false,
    plans: buildPlans(10_000, 20_000, 40_000, 35_000, 3_750),
  },
  BLACK: {
    tier: 'BLACK',
    level: 5,
    name: '5 BLACK',
    description:
      'Para inmobiliarias consolidadas: mayor descuento y asistencia jurídica.',
    propertyLimit: 500,
    crmSeats: 5,
    brcDiscountPct: 10,
    videoDiscountPct: 10,
    legalTickets: 3,
    certifiedProfessionalsNetwork: false,
    notaryNetwork: false,
    legalFormsLibrary: false,
    allowsStacking: false,
    plans: buildPlans(15_000, 30_000, 60_000, 50_000, 5_500),
  },
  PLATINO: {
    tier: 'PLATINO',
    level: 6,
    name: '6 PLATINO',
    description:
      'El nivel máximo: red de profesionales y notarios, biblioteca jurídica y membresías acumulables.',
    propertyLimit: 800,
    crmSeats: 6,
    brcDiscountPct: 15,
    videoDiscountPct: 15,
    legalTickets: 6,
    certifiedProfessionalsNetwork: true,
    notaryNetwork: true,
    legalFormsLibrary: true,
    allowsStacking: true,
    plans: buildPlans(20_000, 40_000, 80_000, 70_000, 7_500),
  },
};

// ──────────────────────────────────────────────────────────────
// Benefit matrix (drives the comparison table on the landing page)
// ──────────────────────────────────────────────────────────────

/**
 * Benefits the PDF marks with "(*)" are listed as "(*En desarrollo)".
 * They must stay visible in the catalogue — the client is buying them — but
 * the UI has to label them "próximamente" instead of presenting them as live.
 */
export interface MembershipBenefitRow {
  key:
    | 'propertyLimit'
    | 'crmSeats'
    | 'brcDiscountPct'
    | 'videoDiscountPct'
    | 'legalTickets'
    | 'certifiedProfessionalsNetwork'
    | 'notaryNetwork'
    | 'legalFormsLibrary';
  label: string;
  kind: 'number' | 'percent' | 'boolean';
  /** True when the PDF marks the row "(*En desarrollo)". */
  inDevelopment: boolean;
}

export const MEMBERSHIP_BENEFIT_ROWS: MembershipBenefitRow[] = [
  {
    key: 'propertyLimit',
    label: 'Propiedades a publicar',
    kind: 'number',
    inDevelopment: false,
  },
  {
    key: 'crmSeats',
    label: 'Cuentas de acceso al CRM inmobiliario',
    kind: 'number',
    inDevelopment: false,
  },
  {
    key: 'brcDiscountPct',
    label: 'Descuento emisión de certificados BRC',
    kind: 'percent',
    inDevelopment: false,
  },
  {
    key: 'videoDiscountPct',
    label: 'Descuento videos de propiedades',
    kind: 'percent',
    inDevelopment: true,
  },
  {
    key: 'legalTickets',
    label: 'Tickets para consultas jurídicas inmobiliarias',
    kind: 'number',
    inDevelopment: true,
  },
  {
    key: 'certifiedProfessionalsNetwork',
    label: 'Red de profesionales inmobiliarios certificados',
    kind: 'boolean',
    inDevelopment: true,
  },
  {
    key: 'notaryNetwork',
    label: 'Red de notarios con convenio',
    kind: 'boolean',
    inDevelopment: true,
  },
  {
    key: 'legalFormsLibrary',
    label: 'Acceso a formatos inmobiliarios',
    kind: 'boolean',
    inDevelopment: true,
  },
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Type guard so untrusted strings (query params, DB rows) can be narrowed. */
export function isMembershipTier(value: string): value is MembershipTierKey {
  return Object.prototype.hasOwnProperty.call(MEMBERSHIP_CATALOG, value);
}

export function isMembershipPeriod(
  value: string,
): value is MembershipPeriodKey {
  return Object.prototype.hasOwnProperty.call(
    MEMBERSHIP_PERIOD_MONTHS,
    value,
  );
}

export function getPlan(tier: MembershipTierKey): MembershipTierDefinition {
  return MEMBERSHIP_CATALOG[tier];
}

/** Full pricing row for one tier/period combination (one of the 24 plans). */
export function getPlanPricing(
  tier: MembershipTierKey,
  period: MembershipPeriodKey,
): MembershipPeriodPricing {
  return MEMBERSHIP_CATALOG[tier].plans[period];
}

/** Contract price in MXN, before IVA. */
export function getPriceFor(
  tier: MembershipTierKey,
  period: MembershipPeriodKey,
): number {
  return MEMBERSHIP_CATALOG[tier].plans[period].total;
}

/** Contract price with IVA added. Rounded to cents. */
export function getPriceWithIva(
  tier: MembershipTierKey,
  period: MembershipPeriodKey,
): number {
  return (
    Math.round(getPriceFor(tier, period) * (1 + MEMBERSHIP_IVA_RATE) * 100) / 100
  );
}

/**
 * Savings of the prepaid annual plan against the 12-month annual plan (A4).
 * Always positive in the current catalogue.
 */
export function getPrepaidAnnualSavings(tier: MembershipTierKey): number {
  const { ANUAL, ANUAL_ANTICIPADO } = MEMBERSHIP_CATALOG[tier].plans;
  return ANUAL.total - ANUAL_ANTICIPADO.total;
}

export function getPrepaidAnnualSavingsPct(tier: MembershipTierKey): number {
  const anual = MEMBERSHIP_CATALOG[tier].plans.ANUAL.total;
  return Math.round((getPrepaidAnnualSavings(tier) / anual) * 100);
}

export function getBrcDiscountPct(tier: MembershipTierKey): number {
  return MEMBERSHIP_CATALOG[tier].brcDiscountPct;
}

export function getVideoDiscountPct(tier: MembershipTierKey): number {
  return MEMBERSHIP_CATALOG[tier].videoDiscountPct;
}

export function getPropertyLimit(tier: MembershipTierKey): number {
  return MEMBERSHIP_CATALOG[tier].propertyLimit;
}

export function getCrmSeats(tier: MembershipTierKey): number {
  return MEMBERSHIP_CATALOG[tier].crmSeats;
}

/**
 * Legal-consultation tickets actually granted for a contract.
 *
 * The tier grants them nominally (BLACK 3, PLATINO 6) but the PDF restricts
 * them to the prepaid annual plan, so any other period grants zero. Callers
 * that need the nominal figure for the comparison table read
 * `getPlan(tier).legalTickets` instead.
 */
export function getLegalTickets(
  tier: MembershipTierKey,
  period: MembershipPeriodKey,
): number {
  const def = MEMBERSHIP_CATALOG[tier];
  return period === 'ANUAL_ANTICIPADO' ? def.legalTickets : 0;
}

/** A6 — only PLATINO may hold stacked (child) memberships. */
export function allowsStacking(tier: MembershipTierKey): boolean {
  return MEMBERSHIP_CATALOG[tier].allowsStacking;
}

/** Ordinal used to compare tiers for upgrade / downgrade decisions. */
export function getTierLevel(tier: MembershipTierKey): number {
  return MEMBERSHIP_CATALOG[tier].level;
}

/** Ordered list, cheapest first — the order the landing page renders. */
export function listMembershipPlans(): MembershipTierDefinition[] {
  return MEMBERSHIP_TIERS.map((tier) => MEMBERSHIP_CATALOG[tier]);
}

/** Money formatter shared by every membership surface. */
export function formatMembershipPrice(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: MEMBERSHIP_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
