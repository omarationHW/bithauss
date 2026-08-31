/**
 * Membership entitlements — pure domain logic.
 *
 * Everything here is a pure function of (holdings, now). No fetching, no
 * Supabase, no React: the same rules run in the browser to grey out a button
 * and on the server to reject a request, and both must agree. The numbers
 * themselves live in @bithauss/config (transcribed from the Módulo Membresías
 * PDF); this file only decides what a *client* is entitled to.
 *
 * Normativa implemented here:
 *   A2 — 7-day free trial with reduced limits, auto-charge on expiry.
 *   A3 — 3/6/12-month contract terms, expiry tracking.
 *   A5 — a subscription only entitles anything once payment was
 *        double-verified; PENDIENTE_PAGO grants nothing.
 *   A6 — only PLATINO stacks extra memberships; upgrades go up only, a
 *        downgrade must be refused (cancel + new contract).
 */

import {
  MEMBERSHIP_CATALOG,
  MEMBERSHIP_TRIAL_CRM_SEATS,
  MEMBERSHIP_TRIAL_DAYS,
  MEMBERSHIP_TRIAL_PROPERTY_LIMIT,
  MEMBERSHIP_TRIAL_TRAINING_SEATS,
  getLegalTickets,
  getPlan,
  getTierLevel,
  type MembershipPeriodKey,
  type MembershipTierKey,
} from "@bithauss/config";

/** Subscription states that grant entitlements. */
export type MembershipStatus =
  | "PRUEBA"
  | "PENDIENTE_PAGO"
  | "ACTIVA"
  | "SUSPENDIDA"
  | "CANCELADA"
  | "VENCIDA";

/**
 * One membership a client holds. A stacked (A6) set is modelled as one
 * holding with `parentSubscriptionId === null` plus N holdings pointing at it.
 */
export interface MembershipHolding {
  id: string;
  tier: MembershipTierKey;
  period: MembershipPeriodKey;
  status: MembershipStatus;
  /** ISO timestamp — end of the paid term (A3). */
  currentPeriodEnd: string;
  /** ISO timestamp — end of the 7-day trial, null when no trial applied. */
  trialEndsAt?: string | null;
  /** A6 — set on child memberships stacked onto a PLATINO parent. */
  parentSubscriptionId?: string | null;
  /** A5 — who confirmed the payment; null means "not verified yet". */
  paymentConfirmedBy?: string | null;
}

export interface MembershipEntitlements {
  /** Properties the client may have published at once. */
  propertyLimit: number;
  /** CRM seats the client may create. */
  crmSeats: number;
  /** Best BRC issuance discount across the holdings, in percent. */
  brcDiscountPct: number;
  /** Best property-video discount across the holdings, in percent. */
  videoDiscountPct: number;
  /** Legal-consultation tickets granted in total (prepaid annual only). */
  legalTicketsGranted: number;
  hasCertifiedProfessionalsNetwork: boolean;
  hasNotaryNetwork: boolean;
  hasLegalFormsLibrary: boolean;
  /** Webinar/training seats — only the trial grants these today. */
  trainingSeats: number;
  /** True while the client is inside the A2 free trial. */
  isTrial: boolean;
  /** Tiers actually contributing to the numbers above. */
  contributingTiers: MembershipTierKey[];
}

export const EMPTY_ENTITLEMENTS: MembershipEntitlements = {
  propertyLimit: 0,
  crmSeats: 0,
  brcDiscountPct: 0,
  videoDiscountPct: 0,
  legalTicketsGranted: 0,
  hasCertifiedProfessionalsNetwork: false,
  hasNotaryNetwork: false,
  hasLegalFormsLibrary: false,
  trainingSeats: 0,
  isTrial: false,
  contributingTiers: [],
};

const MS_PER_DAY = 86_400_000;

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Whole days left until `deadline`, floored at 0. Uses ceil so that "expires
 * in 30 minutes" still reads as "1 día" rather than "0 días" — the client is
 * still entitled today.
 */
export function daysRemaining(
  deadline: string | Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!deadline) return 0;
  const diff = toTime(deadline) - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

// ──────────────────────────────────────────────────────────────
// A2 — free trial
// ──────────────────────────────────────────────────────────────

/** End of the trial for a subscription that starts now (7 natural days). */
export function computeTrialEnd(start: string | Date = new Date()): Date {
  return new Date(toTime(start) + MEMBERSHIP_TRIAL_DAYS * MS_PER_DAY);
}

/**
 * True while the trial is still running. A holding whose status has already
 * moved past PRUEBA is not on trial even if `trialEndsAt` is in the future.
 */
export function isTrialActive(
  holding: Pick<MembershipHolding, "status" | "trialEndsAt">,
  now: Date = new Date(),
): boolean {
  if (holding.status !== "PRUEBA") return false;
  if (!holding.trialEndsAt) return false;
  return toTime(holding.trialEndsAt) > now.getTime();
}

/** True when the trial window has closed and the plan must now be charged. */
export function isTrialExpired(
  holding: Pick<MembershipHolding, "status" | "trialEndsAt">,
  now: Date = new Date(),
): boolean {
  if (holding.status !== "PRUEBA") return false;
  if (!holding.trialEndsAt) return false;
  return toTime(holding.trialEndsAt) <= now.getTime();
}

export function trialDaysRemaining(
  holding: Pick<MembershipHolding, "status" | "trialEndsAt">,
  now: Date = new Date(),
): number {
  if (!isTrialActive(holding, now)) return 0;
  return daysRemaining(holding.trialEndsAt, now);
}

// ──────────────────────────────────────────────────────────────
// A3/A5 — is this holding worth anything right now?
// ──────────────────────────────────────────────────────────────

/**
 * A holding grants entitlements only when it is ACTIVA (and paid) or inside
 * its trial. PENDIENTE_PAGO grants nothing on purpose: A5 requires the second
 * actor's confirmation *before* access, so an unconfirmed subscription must
 * behave exactly like no subscription at all.
 */
export function isHoldingEffective(
  holding: MembershipHolding,
  now: Date = new Date(),
): boolean {
  if (isTrialActive(holding, now)) return true;
  if (holding.status !== "ACTIVA") return false;
  // Defence in depth: an ACTIVA row without a confirmed payment should not
  // exist, but if one slips through it must not unlock anything.
  if (holding.paymentConfirmedBy === null) return false;
  return toTime(holding.currentPeriodEnd) > now.getTime();
}

/** A3 — the paid term has run out. */
export function isExpired(
  holding: Pick<MembershipHolding, "currentPeriodEnd">,
  now: Date = new Date(),
): boolean {
  return toTime(holding.currentPeriodEnd) <= now.getTime();
}

/** Renewal campaigns fire inside this window before the term ends. */
export const RENEWAL_NOTICE_DAYS = 30;

export function isRenewalDue(
  holding: Pick<MembershipHolding, "currentPeriodEnd">,
  now: Date = new Date(),
  windowDays: number = RENEWAL_NOTICE_DAYS,
): boolean {
  const left = daysRemaining(holding.currentPeriodEnd, now);
  return left > 0 && left <= windowDays;
}

// ──────────────────────────────────────────────────────────────
// A6 — accumulation
// ──────────────────────────────────────────────────────────────

/**
 * Effective entitlements for a whole set of holdings.
 *
 * Quantities that are countable (properties, CRM seats, legal tickets) are
 * summed — that is exactly the PDF's example: 6 PLATINO + 5 BLACK = 800 + 500
 * = 1,300 properties. Percentages are NOT summed (25% off would be an
 * invented discount); the client keeps the best one. Boolean perks are OR-ed.
 *
 * Stacking is only honoured when the set is anchored by a PLATINO membership.
 * If somebody manages to persist e.g. GOLD + BLACK, this function ignores the
 * extras and bills the client only for the single best holding rather than
 * silently handing out an accumulation the normativa forbids.
 */
export function computeEntitlements(
  holdings: MembershipHolding[],
  now: Date = new Date(),
): MembershipEntitlements {
  const effective = holdings.filter((h) => isHoldingEffective(h, now));
  if (effective.length === 0) return { ...EMPTY_ENTITLEMENTS };

  // Trial holdings are exclusive: while on trial the client gets the fixed
  // trial allowance, never a tier's allowance.
  const trial = effective.find((h) => isTrialActive(h, now));
  if (trial) {
    return {
      propertyLimit: MEMBERSHIP_TRIAL_PROPERTY_LIMIT,
      crmSeats: MEMBERSHIP_TRIAL_CRM_SEATS,
      brcDiscountPct: 0,
      videoDiscountPct: 0,
      legalTicketsGranted: 0,
      hasCertifiedProfessionalsNetwork: false,
      hasNotaryNetwork: false,
      hasLegalFormsLibrary: false,
      trainingSeats: MEMBERSHIP_TRIAL_TRAINING_SEATS,
      isTrial: true,
      contributingTiers: [trial.tier],
    };
  }

  const counted = selectAccumulableHoldings(effective);

  const acc: MembershipEntitlements = {
    ...EMPTY_ENTITLEMENTS,
    contributingTiers: counted.map((h) => h.tier),
  };

  for (const holding of counted) {
    const def = getPlan(holding.tier);
    acc.propertyLimit += def.propertyLimit;
    acc.crmSeats += def.crmSeats;
    acc.brcDiscountPct = Math.max(acc.brcDiscountPct, def.brcDiscountPct);
    acc.videoDiscountPct = Math.max(acc.videoDiscountPct, def.videoDiscountPct);
    acc.legalTicketsGranted += getLegalTickets(holding.tier, holding.period);
    acc.hasCertifiedProfessionalsNetwork ||= def.certifiedProfessionalsNetwork;
    acc.hasNotaryNetwork ||= def.notaryNetwork;
    acc.hasLegalFormsLibrary ||= def.legalFormsLibrary;
  }

  return acc;
}

/**
 * Which of the effective holdings actually add up.
 * With a PLATINO anchor: all of them (A6). Without one: only the best single
 * holding, because no other tier may accumulate.
 */
function selectAccumulableHoldings(
  effective: MembershipHolding[],
): MembershipHolding[] {
  const hasPlatino = effective.some((h) => h.tier === "PLATINO");
  if (hasPlatino) return effective;

  return [
    effective.reduce((best, h) =>
      getTierLevel(h.tier) > getTierLevel(best.tier) ? h : best,
    ),
  ];
}

export interface StackingDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * A6 — may this client stack another membership onto `holdings`?
 * Requires an effective PLATINO membership to anchor the accumulation.
 */
export function canStackMembership(
  holdings: MembershipHolding[],
  now: Date = new Date(),
): StackingDecision {
  const platino = holdings.find(
    (h) => h.tier === "PLATINO" && isHoldingEffective(h, now),
  );
  if (!platino) {
    return {
      allowed: false,
      reason:
        "Sólo la Membresía 6 PLATINO permite acumular membresías adicionales. Haz upgrade a PLATINO para sumar propiedades y beneficios.",
    };
  }
  return { allowed: true };
}

// ──────────────────────────────────────────────────────────────
// A6 — upgrade / downgrade
// ──────────────────────────────────────────────────────────────

export type MembershipChangeKind = "UPGRADE" | "DOWNGRADE" | "SAME_TIER";

export function classifyTierChange(
  current: MembershipTierKey,
  target: MembershipTierKey,
): MembershipChangeKind {
  const from = getTierLevel(current);
  const to = getTierLevel(target);
  if (to > from) return "UPGRADE";
  if (to < from) return "DOWNGRADE";
  return "SAME_TIER";
}

export interface UpgradeDecision {
  allowed: boolean;
  kind: MembershipChangeKind;
  /** A6 — an upgrade only takes effect after the payment is double-verified. */
  requiresPaymentDoubleVerification: boolean;
  reason?: string;
}

/**
 * A6 — the system only allows upgrades between plans, with double payment
 * verification. A downgrade is refused: the client has to cancel the contract
 * and open a new one, which is a different (manual) flow on purpose.
 */
export function evaluateUpgrade(
  current: MembershipTierKey,
  target: MembershipTierKey,
): UpgradeDecision {
  const kind = classifyTierChange(current, target);

  if (kind === "DOWNGRADE") {
    return {
      allowed: false,
      kind,
      requiresPaymentDoubleVerification: false,
      reason:
        "No es posible bajar de nivel de membresía. Para contratar un nivel menor debes cancelar el contrato vigente y abrir uno nuevo.",
    };
  }

  if (kind === "SAME_TIER") {
    return {
      allowed: false,
      kind,
      requiresPaymentDoubleVerification: false,
      reason: "Ya cuentas con esta membresía.",
    };
  }

  return { allowed: true, kind, requiresPaymentDoubleVerification: true };
}

/** Convenience predicate for UI that only needs to grey out a button. */
export function isDowngradeBlocked(
  current: MembershipTierKey,
  target: MembershipTierKey,
): boolean {
  return classifyTierChange(current, target) === "DOWNGRADE";
}

/** Tiers a client may upgrade to from `current` (strictly higher levels). */
export function availableUpgradeTiers(
  current: MembershipTierKey,
): MembershipTierKey[] {
  const level = getTierLevel(current);
  return (Object.keys(MEMBERSHIP_CATALOG) as MembershipTierKey[]).filter(
    (tier) => getTierLevel(tier) > level,
  );
}

// ──────────────────────────────────────────────────────────────
// Consumption
// ──────────────────────────────────────────────────────────────

export interface UsageSnapshot {
  publishedProperties: number;
  crmSeatsUsed: number;
  legalTicketsUsed: number;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  /** 0..100, capped — safe to feed straight into a progress bar width. */
  percentUsed: number;
  isAtLimit: boolean;
  /** True from 80% onwards, so the UI can warn before the wall. */
  isNearLimit: boolean;
}

export function quotaState(used: number, limit: number): QuotaState {
  const safeLimit = Math.max(limit, 0);
  const remaining = Math.max(safeLimit - used, 0);
  const percentUsed =
    safeLimit === 0 ? 100 : Math.min(Math.round((used / safeLimit) * 100), 100);
  return {
    used,
    limit: safeLimit,
    remaining,
    percentUsed,
    isAtLimit: used >= safeLimit,
    isNearLimit: percentUsed >= 80,
  };
}

/** Server-side gate: may one more property be published? */
export function canPublishProperty(
  entitlements: MembershipEntitlements,
  publishedProperties: number,
): boolean {
  return publishedProperties < entitlements.propertyLimit;
}

/** Server-side gate: may one more CRM seat be created? */
export function canCreateCrmSeat(
  entitlements: MembershipEntitlements,
  crmSeatsUsed: number,
): boolean {
  return crmSeatsUsed < entitlements.crmSeats;
}

export function legalTicketsAvailable(
  entitlements: MembershipEntitlements,
  legalTicketsUsed: number,
): number {
  return Math.max(entitlements.legalTicketsGranted - legalTicketsUsed, 0);
}

export function canConsumeLegalTicket(
  entitlements: MembershipEntitlements,
  legalTicketsUsed: number,
): boolean {
  return legalTicketsAvailable(entitlements, legalTicketsUsed) > 0;
}

// ──────────────────────────────────────────────────────────────
// Discounts
// ──────────────────────────────────────────────────────────────

/**
 * Applies a membership discount to a base amount.
 * NOTE: `amount` must be the pre-IVA amount — IVA is computed on the
 * discounted subtotal, never the other way round.
 */
export function applyDiscount(amount: number, discountPct: number): number {
  if (discountPct <= 0) return amount;
  return Math.round(amount * (1 - discountPct / 100) * 100) / 100;
}

export function brcPriceAfterMembership(
  entitlements: MembershipEntitlements,
  basePrice: number,
): number {
  return applyDiscount(basePrice, entitlements.brcDiscountPct);
}

export function videoPriceAfterMembership(
  entitlements: MembershipEntitlements,
  basePrice: number,
): number {
  return applyDiscount(basePrice, entitlements.videoDiscountPct);
}
