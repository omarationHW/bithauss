/**
 * BRC certificate pricing calculator.
 *
 * Single source of truth for what the owner pays to certify a property. The
 * result carries TWO planes, and mixing them up is the one mistake to avoid:
 *
 * ACCOUNTING PLANE (internal — payment row, reconciliation, bookkeeping):
 *   base      → official tariff for the property value bracket (MXN)
 *   discount  → membership discount applied on the base
 *   subtotal  → base − discount
 *   iva       → 16% of the subtotal
 *   gatewayFee→ Stripe commission, passed on to the customer (gross-up)
 *   total     → what the card is charged
 *
 * PRESENTATION PLANE (the ONLY numbers the customer may see):
 *   displayBase     → list price with the commission already absorbed
 *   displayDiscount → membership discount, same proportion, grossed up
 *   displaySubtotal → displayBase − displayDiscount = total ÷ (1 + IVA)
 *   displayIva      → total − displaySubtotal
 *   total           → identical to the accounting total; nothing is charged twice
 *
 * The customer pays the gateway commission INSIDE the service price and never
 * sees it itemised (client instruction; STRIPE_FEE_SHOWN_TO_CUSTOMER = false).
 * The presentation plane is built so it reconciles on screen — displayed
 * subtotal + displayed IVA is exactly the total — which also means the fee
 * cannot be recovered by subtracting the visible lines.
 *
 * Every rate lives in `@bithauss/config` so neither this file nor the UI ever
 * hardcodes a percentage.
 *
 * NOTE: `apps/api/src/modules/payments/brc-pricing.ts` mirrors this module so
 * the server can recompute the amount without trusting the browser. Keep both
 * in sync; the shared constants make the two implementations agree by
 * construction.
 */
import {
  BRC_TARIFF_BRACKETS,
  BRC_CHARGE_CURRENCY,
  BRC_MEMBERSHIP_DISCOUNT_PCT,
  IVA_RATE,
  STRIPE_FEE_IS_TAXED,
  STRIPE_FEE_PASSED_TO_CUSTOMER,
  STRIPE_MX_CARD_FIXED_MXN,
  STRIPE_MX_CARD_PCT,
  USD_TO_MXN_FALLBACK_RATE,
} from "@bithauss/config";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BrcTariffBracket {
  id: string;
  /** Exclusive lower bound (inclusive only for the first bracket, where it is 0). */
  minMxn: number;
  /** Inclusive upper bound; null on the open-ended last bracket. */
  maxMxn: number | null;
  amountMxn: number;
  label: string;
}

export interface BrcPriceBreakdown {
  /* ---- Accounting plane: internal use only, never rendered ---- */
  /**
   * INTERNAL. Official tariff for the bracket, before any discount.
   * Do not render: it excludes the absorbed gateway commission, so showing it
   * next to `displaySubtotal` would expose the fee by subtraction.
   */
  base: number;
  /** INTERNAL. Membership discount applied on the base (positive number). */
  discount: number;
  /** INTERNAL. base − discount. */
  subtotal: number;
  /** INTERNAL. VAT over the internal subtotal. */
  iva: number;
  /**
   * INTERNAL — MUST NOT BE RENDERED. Stripe commission transferred to the
   * customer inside the price. Persisted on the payment row so accounting can
   * reconcile against Stripe's settlement report.
   */
  gatewayFee: number;
  /** Amount actually charged to the card. Shown to the customer as-is. */
  total: number;

  /* ---- Presentation plane: what the customer is allowed to see ---- */
  /**
   * List price with the gateway commission already absorbed. Equals
   * `displaySubtotal` when there is no membership discount.
   */
  displayBase: number;
  /** Membership discount in the same proportion, grossed up. */
  displayDiscount: number;
  /** `total ÷ (1 + ivaRate)`; the "Certificación BRC" line. */
  displaySubtotal: number;
  /** `total − displaySubtotal`, i.e. the VAT line that makes the total add up. */
  displayIva: number;
  /** Always MXN: the tariff table is published in pesos. */
  currency: string;
  /** Human label of the applied tariff, e.g. "Certificado BRC · De 5 a 10 mdp". */
  tariffLabel: string;
  /** Human label of the value bracket, e.g. "De $5,000,000 a $10,000,000 MXN". */
  valueRangeLabel: string;
  /** Bracket id, useful for analytics / persisting which tariff was used. */
  bracketId: string;
  /** Property value in MXN the bracket was resolved with. */
  propertyValueMxn: number;
  /** Discount rate actually applied (0–1). */
  membershipDiscountPct: number;
  /** VAT rate actually applied (0–1). */
  ivaRate: number;
  /**
   * False when the property has no usable price (null, 0 or NaN). The cheapest
   * bracket is quoted so the UI never blanks out, but it must warn the user.
   */
  hasValidPropertyValue: boolean;
}

export interface BrcPriceInput {
  /** Legacy single price column. */
  price?: number | null;
  /** Preferred sale price; wins over `price` when present. */
  price_sale?: number | null;
  /** Currency the property is listed in ("MXN" | "USD"). */
  currency?: string | null;
  /** Membership discount as a fraction (0.10 = 10%). Defaults to 0. */
  membershipDiscountPct?: number;
  /** Override the FX rate (feed it from the ticker when available). */
  usdToMxnRate?: number;
  /** Override the VAT rate (kept for future tax-regime changes). */
  ivaRate?: number;
}

/* ------------------------------------------------------------------ */
/*  Money helpers                                                      */
/* ------------------------------------------------------------------ */

/** Rounds to cents, half-up, killing binary floating point noise. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds UP to cents. Used for the grossed-up total: rounding down could
 * leave BitHauss a cent short of `subtotal + iva` after Stripe takes its cut.
 */
export function ceilMoney(value: number): number {
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

/** `Intl` money formatting, Mexican locale. Kept here so UI never re-invents it. */
export function formatMoney(
  amount: number,
  currency: string = BRC_CHARGE_CURRENCY,
  opts: { cents?: boolean } = {},
): string {
  const fractionDigits = opts.cents ? 2 : 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Bracket resolution                                                 */
/* ------------------------------------------------------------------ */

/**
 * Converts the listing price to MXN. The tariff table is published in pesos,
 * so a USD listing must be converted before the bracket lookup — otherwise a
 * USD 600,000 house (≈ 11 mdp) would be quoted as if it were worth 600k MXN.
 */
export function toMxn(
  amount: number,
  currency: string | null | undefined,
  usdToMxnRate: number = USD_TO_MXN_FALLBACK_RATE,
): number {
  if ((currency ?? BRC_CHARGE_CURRENCY).toUpperCase() === "USD") {
    return amount * usdToMxnRate;
  }
  return amount;
}

/**
 * Picks the sale price when present, falling back to the legacy `price`.
 * Returns 0 for anything unusable so callers get a deterministic number.
 */
export function resolvePropertyValue(input: BrcPriceInput): number {
  const raw = input.price_sale ?? input.price ?? 0;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

/**
 * Finds the bracket for a value expressed in MXN.
 *
 * Boundaries are inclusive on the upper end: exactly 5,000,000 stays in
 * "Hasta 5 mdp", 5,000,000.01 moves to "De 5 a 10 mdp", and anything strictly
 * above 40,000,000 lands in "Superior a 40 mdp". Because the table is ordered
 * ascending, "the first bracket whose max covers the value" implements that
 * rule exactly.
 */
export function findTariffBracket(valueMxn: number): BrcTariffBracket {
  const safeValue = Number.isFinite(valueMxn) && valueMxn > 0 ? valueMxn : 0;
  const bracket =
    BRC_TARIFF_BRACKETS.find((b) => b.maxMxn === null || safeValue <= b.maxMxn) ??
    BRC_TARIFF_BRACKETS[BRC_TARIFF_BRACKETS.length - 1]!;
  return bracket as unknown as BrcTariffBracket;
}

/** "De $5,000,000 a $10,000,000 MXN" / "Más de $40,000,000 MXN". */
export function describeValueRange(bracket: BrcTariffBracket): string {
  if (bracket.maxMxn === null) {
    return `Más de ${formatMoney(bracket.minMxn)} MXN`;
  }
  if (bracket.minMxn === 0) {
    return `Hasta ${formatMoney(bracket.maxMxn)} MXN`;
  }
  return `De ${formatMoney(bracket.minMxn)} a ${formatMoney(bracket.maxMxn)} MXN`;
}

/** Discount fraction for a membership tier; unknown/none tiers pay full price. */
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

/* ------------------------------------------------------------------ */
/*  Gateway gross-up                                                   */
/* ------------------------------------------------------------------ */

/**
 * Effective Stripe rates once VAT on the commission is taken into account.
 * Stripe MX charges 3.6% + $3.00 MXN and invoices that WITH VAT, so the real
 * cost is 3.6% × 1.16 and $3.00 × 1.16.
 */
export function stripeEffectiveRates(ivaRate: number = IVA_RATE): {
  pctTotal: number;
  fixedTotal: number;
} {
  const multiplier = STRIPE_FEE_IS_TAXED ? 1 + ivaRate : 1;
  return {
    pctTotal: STRIPE_MX_CARD_PCT * multiplier,
    fixedTotal: STRIPE_MX_CARD_FIXED_MXN * multiplier,
  };
}

/**
 * Solves for the charge amount `T` such that, after Stripe deducts
 * `T × pctTotal + fixedTotal`, BitHauss is left with exactly `net`:
 *
 *   T − (T × pct + fixed) = net   ⟹   T = (net + fixed) / (1 − pct)
 *
 * Rounded UP to the cent so the deduction can never leave the net short.
 */
export function grossUpForGateway(net: number, ivaRate: number = IVA_RATE): number {
  const { pctTotal, fixedTotal } = stripeEffectiveRates(ivaRate);
  return ceilMoney((net + fixedTotal) / (1 - pctTotal));
}

/** What Stripe will actually deduct from a charge of `total`. */
export function stripeFeeOn(total: number, ivaRate: number = IVA_RATE): number {
  const { pctTotal, fixedTotal } = stripeEffectiveRates(ivaRate);
  return total * pctTotal + fixedTotal;
}

/* ------------------------------------------------------------------ */
/*  Presentation plane                                                 */
/* ------------------------------------------------------------------ */

/**
 * Rebuilds the breakdown as the customer sees it, with the gateway commission
 * absorbed into the service price.
 *
 * Everything is derived FROM the charged total (never re-added to it), so:
 *   displaySubtotal + displayIva === total          — exact, to the cent
 *   displayBase     − displayDiscount === displaySubtotal
 *
 * `displayIva` is computed as the remainder rather than as
 * `displaySubtotal × ivaRate` so the three visible lines always reconcile;
 * the two differ by at most half a cent, which rounding absorbs.
 *
 * The list price and the discount are scaled by the same factor as the
 * subtotal, so the discount still reads as the advertised percentage and no
 * visible line contradicts another.
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

  // A fully discounted (or zero) subtotal has no ratio to scale by; there is
  // nothing to show as a discount either.
  const scale = input.subtotal > 0 ? displaySubtotal / input.subtotal : 1;
  const displayBase =
    input.discount > 0 ? roundMoney(input.base * scale) : displaySubtotal;
  const displayDiscount =
    input.discount > 0 ? roundMoney(displayBase - displaySubtotal) : 0;

  return { displayBase, displayDiscount, displaySubtotal, displayIva };
}

/* ------------------------------------------------------------------ */
/*  Main calculator                                                    */
/* ------------------------------------------------------------------ */

/**
 * Computes the full BRC price breakdown.
 *
 * Pure function: no I/O, no clock, no globals — the API mirrors it so the
 * server can recompute the same total without trusting the client.
 */
export function calculateBrcPrice(input: BrcPriceInput): BrcPriceBreakdown {
  const ivaRate = input.ivaRate ?? IVA_RATE;
  const usdToMxnRate = input.usdToMxnRate ?? USD_TO_MXN_FALLBACK_RATE;

  const rawValue = resolvePropertyValue(input);
  const hasValidPropertyValue = rawValue > 0;
  const propertyValueMxn = roundMoney(toMxn(rawValue, input.currency, usdToMxnRate));

  const bracket = findTariffBracket(propertyValueMxn);
  const base = bracket.amountMxn;

  // Clamp so a bad membership payload can never produce a negative subtotal
  // or a discount above the base.
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
