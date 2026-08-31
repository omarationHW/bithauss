/**
 * Server-side BRC pricing.
 *
 * MIRROR of `apps/web/src/lib/brc-pricing.ts`. It is duplicated rather than
 * imported because `@bithauss/config` ships TypeScript sources and the API is
 * compiled with `rootDir: ./src`; pulling the workspace package in would break
 * `nest build`. The constants below are copied verbatim from
 * `packages/config/src/constants.ts` — change them there first, then here.
 *
 * This is the ONLY price the customer is ever charged: the browser never
 * sends an amount, the server recomputes it from the property value.
 *
 * Two planes, same as the web module:
 *   - accounting (base/discount/subtotal/iva/gatewayFee/total) → payment row,
 *     reconciliation against Stripe's settlement report;
 *   - presentation (displayBase/displayDiscount/displaySubtotal/displayIva +
 *     total) → the only numbers that may reach the customer. The gateway
 *     commission is absorbed into the service price and never itemised.
 */

/** Official price list — "Precios para obtener el Certificado BRC" (2026). */
export const BRC_TARIFF_BRACKETS = [
  { id: 'HASTA_5M', minMxn: 0, maxMxn: 5_000_000, amountMxn: 10_000, label: 'Hasta 5 mdp' },
  { id: 'DE_5_10M', minMxn: 5_000_000, maxMxn: 10_000_000, amountMxn: 15_000, label: 'De 5 a 10 mdp' },
  { id: 'DE_10_20M', minMxn: 10_000_000, maxMxn: 20_000_000, amountMxn: 20_000, label: 'De 10 a 20 mdp' },
  { id: 'DE_20_30M', minMxn: 20_000_000, maxMxn: 30_000_000, amountMxn: 30_000, label: 'De 20 a 30 mdp' },
  { id: 'DE_30_40M', minMxn: 30_000_000, maxMxn: 40_000_000, amountMxn: 40_000, label: 'De 30 a 40 mdp' },
  { id: 'MAS_40M', minMxn: 40_000_000, maxMxn: null, amountMxn: 50_000, label: 'Superior a 40 mdp' },
] as const;

export const IVA_RATE = 0.16;
export const STRIPE_MX_CARD_PCT = 0.036;
export const STRIPE_MX_CARD_FIXED_MXN = 3.0;
export const STRIPE_FEE_IS_TAXED = true;
/** The gateway commission is passed on to the customer (gross-up). */
export const STRIPE_FEE_PASSED_TO_CUSTOMER = true;
export const BRC_CHARGE_CURRENCY = 'MXN';
/** Fed from FX config in production; see the web constant of the same name. */
export const USD_TO_MXN_FALLBACK_RATE = 18.5;

export const BRC_MEMBERSHIP_DISCOUNT_PCT: Record<string, number> = {
  START: 0,
  GROW: 0,
  BLUE: 0,
  GOLD: 0.05,
  BLACK: 0.1,
  PLATINO: 0.15,
};

export interface BrcPriceBreakdown {
  /* Accounting plane — internal; `gatewayFee` must never be rendered. */
  base: number;
  discount: number;
  subtotal: number;
  iva: number;
  gatewayFee: number;
  total: number;
  /* Presentation plane — what the customer may see. */
  displayBase: number;
  displayDiscount: number;
  displaySubtotal: number;
  displayIva: number;
  currency: string;
  tariffLabel: string;
  valueRangeLabel: string;
  bracketId: string;
  propertyValueMxn: number;
  membershipDiscountPct: number;
  ivaRate: number;
  hasValidPropertyValue: boolean;
}

export interface BrcPriceInput {
  price?: number | null;
  price_sale?: number | null;
  currency?: string | null;
  membershipDiscountPct?: number;
  usdToMxnRate?: number;
  ivaRate?: number;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Rounds UP so Stripe's cut can never leave the net short of subtotal+IVA. */
export function ceilMoney(value: number): number {
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

export function toMxn(
  amount: number,
  currency: string | null | undefined,
  usdToMxnRate: number = USD_TO_MXN_FALLBACK_RATE,
): number {
  if ((currency ?? BRC_CHARGE_CURRENCY).toUpperCase() === 'USD') {
    return amount * usdToMxnRate;
  }
  return amount;
}

export function resolvePropertyValue(input: BrcPriceInput): number {
  const raw = input.price_sale ?? input.price ?? 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

export interface BrcTariffBracket {
  id: string;
  minMxn: number;
  maxMxn: number | null;
  amountMxn: number;
  label: string;
}

/**
 * Upper bounds are inclusive: exactly 5,000,000 pays the "Hasta 5 mdp" fee,
 * 5,000,000.01 pays the next bracket up.
 */
export function findTariffBracket(valueMxn: number): BrcTariffBracket {
  const safeValue = Number.isFinite(valueMxn) && valueMxn > 0 ? valueMxn : 0;
  const bracket =
    BRC_TARIFF_BRACKETS.find((b) => b.maxMxn === null || safeValue <= b.maxMxn) ??
    BRC_TARIFF_BRACKETS[BRC_TARIFF_BRACKETS.length - 1]!;
  return bracket as unknown as BrcTariffBracket;
}

export function membershipDiscountFor(tier: string | null | undefined): number {
  if (!tier) return 0;
  return BRC_MEMBERSHIP_DISCOUNT_PCT[tier.toUpperCase()] ?? 0;
}

/**
 * Best tier among the client's ACTIVE memberships.
 *
 * A6 lets a PLATINO client STACK extra memberships, so `subscriptions` can
 * hold several ACTIVA rows for one profile. Reading "the first one" (a
 * `.limit(1)`) picks an arbitrary row, and the arbitrary row is quite often
 * the cheap stacked child — which would quietly quote a PLATINO client the
 * 5% discount of a GOLD add-on. The discount the client is entitled to is the
 * BEST of the memberships they hold, so that is what is resolved here.
 *
 * Unknown / retired tiers score 0, so they never win over a real one.
 */
export function bestMembershipTier(
  tiers: readonly (string | null | undefined)[],
): string | null {
  let best: string | null = null;
  let bestPct = -1;
  for (const tier of tiers) {
    if (!tier) continue;
    const pct = membershipDiscountFor(tier);
    if (pct > bestPct) {
      best = tier;
      bestPct = pct;
    }
  }
  return best;
}

export function stripeEffectiveRates(ivaRate: number = IVA_RATE) {
  const multiplier = STRIPE_FEE_IS_TAXED ? 1 + ivaRate : 1;
  return {
    pctTotal: STRIPE_MX_CARD_PCT * multiplier,
    fixedTotal: STRIPE_MX_CARD_FIXED_MXN * multiplier,
  };
}

/** T = (net + fixed) / (1 − pct) — see the web module for the derivation. */
export function grossUpForGateway(net: number, ivaRate: number = IVA_RATE): number {
  const { pctTotal, fixedTotal } = stripeEffectiveRates(ivaRate);
  return ceilMoney((net + fixedTotal) / (1 - pctTotal));
}

export function stripeFeeOn(total: number, ivaRate: number = IVA_RATE): number {
  const { pctTotal, fixedTotal } = stripeEffectiveRates(ivaRate);
  return total * pctTotal + fixedTotal;
}

function formatMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function describeValueRange(bracket: {
  minMxn: number;
  maxMxn: number | null;
}): string {
  if (bracket.maxMxn === null) return `Más de ${formatMxn(bracket.minMxn)} MXN`;
  if (bracket.minMxn === 0) return `Hasta ${formatMxn(bracket.maxMxn)} MXN`;
  return `De ${formatMxn(bracket.minMxn)} a ${formatMxn(bracket.maxMxn)} MXN`;
}

/**
 * Customer-facing view of the price: the commission is absorbed into the
 * service price, and the lines reconcile exactly
 * (`displaySubtotal + displayIva === total`).
 */
export function buildDisplayPlane(input: {
  base: number;
  discount: number;
  subtotal: number;
  total: number;
  ivaRate: number;
}): {
  displayBase: number;
  displayDiscount: number;
  displaySubtotal: number;
  displayIva: number;
} {
  const displaySubtotal = roundMoney(input.total / (1 + input.ivaRate));
  const displayIva = roundMoney(input.total - displaySubtotal);
  const scale = input.subtotal > 0 ? displaySubtotal / input.subtotal : 1;
  const displayBase =
    input.discount > 0 ? roundMoney(input.base * scale) : displaySubtotal;
  const displayDiscount =
    input.discount > 0 ? roundMoney(displayBase - displaySubtotal) : 0;
  return { displayBase, displayDiscount, displaySubtotal, displayIva };
}

/** Client-safe projection: the accounting plane (incl. the fee) is stripped. */
export interface BrcClientBreakdown {
  displayBase: number;
  displayDiscount: number;
  displaySubtotal: number;
  displayIva: number;
  total: number;
  currency: string;
  tariffLabel: string;
  valueRangeLabel: string;
  bracketId: string;
  propertyValueMxn: number;
  membershipDiscountPct: number;
  ivaRate: number;
  hasValidPropertyValue: boolean;
}

/**
 * Strips the accounting plane before the breakdown leaves the server.
 * Returning `gatewayFee` over HTTP would hand the customer, in devtools, the
 * exact number the UI is not supposed to show.
 */
export function toClientBreakdown(b: BrcPriceBreakdown): BrcClientBreakdown {
  return {
    displayBase: b.displayBase,
    displayDiscount: b.displayDiscount,
    displaySubtotal: b.displaySubtotal,
    displayIva: b.displayIva,
    total: b.total,
    currency: b.currency,
    tariffLabel: b.tariffLabel,
    valueRangeLabel: b.valueRangeLabel,
    bracketId: b.bracketId,
    propertyValueMxn: b.propertyValueMxn,
    membershipDiscountPct: b.membershipDiscountPct,
    ivaRate: b.ivaRate,
    hasValidPropertyValue: b.hasValidPropertyValue,
  };
}

export function calculateBrcPrice(input: BrcPriceInput): BrcPriceBreakdown {
  const ivaRate = input.ivaRate ?? IVA_RATE;
  const usdToMxnRate = input.usdToMxnRate ?? USD_TO_MXN_FALLBACK_RATE;

  const rawValue = resolvePropertyValue(input);
  const hasValidPropertyValue = rawValue > 0;
  const propertyValueMxn = roundMoney(toMxn(rawValue, input.currency, usdToMxnRate));

  const bracket = findTariffBracket(propertyValueMxn);
  const base = bracket.amountMxn;

  const discountPct = Math.min(Math.max(input.membershipDiscountPct ?? 0, 0), 1);
  const discount = roundMoney(base * discountPct);
  const subtotal = roundMoney(base - discount);
  const iva = roundMoney(subtotal * ivaRate);
  const net = roundMoney(subtotal + iva);

  const total = STRIPE_FEE_PASSED_TO_CUSTOMER ? grossUpForGateway(net, ivaRate) : net;
  const gatewayFee = roundMoney(total - net);

  const display = buildDisplayPlane({ base, discount, subtotal, total, ivaRate });

  return {
    base,
    discount,
    subtotal,
    iva,
    gatewayFee,
    total,
    ...display,
    currency: BRC_CHARGE_CURRENCY,
    tariffLabel: `Certificado BRC · ${bracket.label}`,
    valueRangeLabel: describeValueRange(bracket),
    bracketId: bracket.id,
    propertyValueMxn,
    membershipDiscountPct: discountPct,
    ivaRate,
    hasValidPropertyValue,
  };
}

/** Stripe charges integer minor units; MXN has two decimals. */
export function toStripeMinorUnits(amount: number): number {
  return Math.round(roundMoney(amount) * 100);
}
