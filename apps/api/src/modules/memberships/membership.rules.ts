/**
 * Membership domain rules — pure functions, no Nest, no Supabase.
 *
 * These mirror `apps/web/src/lib/membership.ts`. The duplication is
 * deliberate: the browser copy exists to grey out buttons, this copy is the
 * one that actually decides, and neither app may import the other's source.
 * Both read the same catalogue from @bithauss/config, so the numbers can
 * never drift — only the plumbing is repeated.
 *
 * Normativa: A2 (7-day trial), A3 (3/6/12-month terms), A5 (double payment
 * verification before access), A6 (PLATINO-only accumulation, upgrade-only).
 */

import {
  MEMBERSHIP_PERIOD_MONTHS,
  MEMBERSHIP_TRIAL_CRM_SEATS,
  MEMBERSHIP_TRIAL_DAYS,
  MEMBERSHIP_TRIAL_PROPERTY_LIMIT,
  getLegalTickets,
  getPlan,
  getTierLevel,
  type MembershipPeriodKey,
  type MembershipTierKey,
} from '@bithauss/config';

export const MS_PER_DAY = 86_400_000;

export type MembershipStatus =
  | 'PRUEBA'
  | 'PENDIENTE_PAGO'
  | 'ACTIVA'
  | 'SUSPENDIDA'
  | 'CANCELADA'
  | 'VENCIDA';

/** The subset of a `subscriptions` row the rules need. */
export interface SubscriptionLike {
  id: string;
  tier: MembershipTierKey;
  period: MembershipPeriodKey;
  status: MembershipStatus;
  current_period_end: string;
  trial_ends_at?: string | null;
  parent_subscription_id?: string | null;
  payment_confirmed_at?: string | null;
}

export interface Entitlements {
  propertyLimit: number;
  crmSeats: number;
  brcDiscountPct: number;
  videoDiscountPct: number;
  legalTicketsGranted: number;
  hasCertifiedProfessionalsNetwork: boolean;
  hasNotaryNetwork: boolean;
  hasLegalFormsLibrary: boolean;
  isTrial: boolean;
  contributingTiers: MembershipTierKey[];
}

export const NO_ENTITLEMENTS: Entitlements = {
  propertyLimit: 0,
  crmSeats: 0,
  brcDiscountPct: 0,
  videoDiscountPct: 0,
  legalTicketsGranted: 0,
  hasCertifiedProfessionalsNetwork: false,
  hasNotaryNetwork: false,
  hasLegalFormsLibrary: false,
  isTrial: false,
  contributingTiers: [],
};

function time(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// ── A2 ────────────────────────────────────────────────────────

export function trialEndFrom(start: Date = new Date()): Date {
  return new Date(start.getTime() + MEMBERSHIP_TRIAL_DAYS * MS_PER_DAY);
}

export function isTrialActive(
  sub: Pick<SubscriptionLike, 'status' | 'trial_ends_at'>,
  now: Date = new Date(),
): boolean {
  return (
    sub.status === 'PRUEBA' &&
    !!sub.trial_ends_at &&
    time(sub.trial_ends_at) > now.getTime()
  );
}

export function isTrialExpired(
  sub: Pick<SubscriptionLike, 'status' | 'trial_ends_at'>,
  now: Date = new Date(),
): boolean {
  return (
    sub.status === 'PRUEBA' &&
    !!sub.trial_ends_at &&
    time(sub.trial_ends_at) <= now.getTime()
  );
}

// ── A3 ────────────────────────────────────────────────────────

/**
 * End of a contract term that starts at `start`, per the plan's length.
 *
 * Day-of-month is clamped to the target month's length, so a contract signed
 * on 31 January runs to 30 April rather than silently rolling over to 1 May —
 * a naive `setMonth` gives the client a free day and misdates the invoice.
 * UTC throughout: the term must not shift with the server's timezone.
 */
export function termEndFrom(
  period: MembershipPeriodKey,
  start: Date = new Date(),
): Date {
  const months = MEMBERSHIP_PERIOD_MONTHS[period];
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  // Day 0 of the following month = last day of the target month.
  const daysInTargetMonth = new Date(
    Date.UTC(year, month + months + 1, 0),
  ).getUTCDate();

  const end = new Date(start.getTime());
  end.setUTCFullYear(year, month + months, Math.min(day, daysInTargetMonth));
  return end;
}

export function daysRemaining(
  deadline: string | Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!deadline) return 0;
  const diff = time(deadline) - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / MS_PER_DAY);
}

// ── A5 ────────────────────────────────────────────────────────

/**
 * A subscription grants entitlements only when it is inside its trial, or
 * ACTIVA with a *confirmed* payment and an unexpired term. An unconfirmed
 * subscription must behave exactly like no subscription: that is the access
 * lock A5 asks for.
 */
export function isEffective(
  sub: SubscriptionLike,
  now: Date = new Date(),
): boolean {
  if (isTrialActive(sub, now)) return true;
  if (sub.status !== 'ACTIVA') return false;
  if (!sub.payment_confirmed_at) return false;
  return time(sub.current_period_end) > now.getTime();
}

// ── A6 ────────────────────────────────────────────────────────

/**
 * Countable benefits add up (800 + 500 = 1,300 properties); percentages take
 * the best value rather than summing into a discount nobody ever sold; flags
 * are OR-ed. Accumulation is only honoured when a PLATINO membership anchors
 * the set — otherwise only the single best membership counts.
 */
export function computeEntitlements(
  subs: SubscriptionLike[],
  now: Date = new Date(),
): Entitlements {
  const effective = subs.filter((s) => isEffective(s, now));
  if (effective.length === 0) return { ...NO_ENTITLEMENTS };

  const trial = effective.find((s) => isTrialActive(s, now));
  if (trial) {
    return {
      ...NO_ENTITLEMENTS,
      propertyLimit: MEMBERSHIP_TRIAL_PROPERTY_LIMIT,
      crmSeats: MEMBERSHIP_TRIAL_CRM_SEATS,
      isTrial: true,
      contributingTiers: [trial.tier],
    };
  }

  const counted = effective.some((s) => s.tier === 'PLATINO')
    ? effective
    : [
        effective.reduce((best, s) =>
          getTierLevel(s.tier) > getTierLevel(best.tier) ? s : best,
        ),
      ];

  const acc: Entitlements = {
    ...NO_ENTITLEMENTS,
    contributingTiers: counted.map((s) => s.tier),
  };

  for (const sub of counted) {
    const def = getPlan(sub.tier);
    acc.propertyLimit += def.propertyLimit;
    acc.crmSeats += def.crmSeats;
    acc.brcDiscountPct = Math.max(acc.brcDiscountPct, def.brcDiscountPct);
    acc.videoDiscountPct = Math.max(acc.videoDiscountPct, def.videoDiscountPct);
    acc.legalTicketsGranted += getLegalTickets(sub.tier, sub.period);
    acc.hasCertifiedProfessionalsNetwork ||= def.certifiedProfessionalsNetwork;
    acc.hasNotaryNetwork ||= def.notaryNetwork;
    acc.hasLegalFormsLibrary ||= def.legalFormsLibrary;
  }

  return acc;
}

export type ChangeKind = 'UPGRADE' | 'DOWNGRADE' | 'SAME_TIER';

export function classifyTierChange(
  current: MembershipTierKey,
  target: MembershipTierKey,
): ChangeKind {
  const from = getTierLevel(current);
  const to = getTierLevel(target);
  if (to > from) return 'UPGRADE';
  if (to < from) return 'DOWNGRADE';
  return 'SAME_TIER';
}

export interface UpgradeDecision {
  allowed: boolean;
  kind: ChangeKind;
  requiresPaymentDoubleVerification: boolean;
  reason?: string;
}

export function evaluateUpgrade(
  current: MembershipTierKey,
  target: MembershipTierKey,
): UpgradeDecision {
  const kind = classifyTierChange(current, target);

  if (kind === 'DOWNGRADE') {
    return {
      allowed: false,
      kind,
      requiresPaymentDoubleVerification: false,
      reason:
        'No es posible bajar de nivel de membresía. Para contratar un nivel menor debes cancelar el contrato vigente y abrir uno nuevo.',
    };
  }

  if (kind === 'SAME_TIER') {
    return {
      allowed: false,
      kind,
      requiresPaymentDoubleVerification: false,
      reason: 'Ya cuentas con esta membresía.',
    };
  }

  return { allowed: true, kind, requiresPaymentDoubleVerification: true };
}

/** A6 — the anchor a stacked membership needs. */
export function findStackingAnchor(
  subs: SubscriptionLike[],
  now: Date = new Date(),
): SubscriptionLike | undefined {
  return subs.find(
    (s) =>
      s.tier === 'PLATINO' && !s.parent_subscription_id && isEffective(s, now),
  );
}

export function canPublishProperty(
  entitlements: Entitlements,
  publishedProperties: number,
): boolean {
  return publishedProperties < entitlements.propertyLimit;
}

export function canCreateCrmSeat(
  entitlements: Entitlements,
  crmSeatsUsed: number,
): boolean {
  return crmSeatsUsed < entitlements.crmSeats;
}

export function legalTicketsAvailable(
  entitlements: Entitlements,
  used: number,
): number {
  return Math.max(entitlements.legalTicketsGranted - used, 0);
}
