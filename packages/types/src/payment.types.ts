/**
 * Payment types (BRC certificate + memberships).
 *
 * Declared as string unions rather than enums because `enums.ts` is shared
 * with other modules and these values live in `payments.payment_type` /
 * `payments.status` as plain text (see migration 026).
 */

/** What the charge is for. */
export type PaymentType = 'SUSCRIPCION' | 'BRC_CERTIFICADO';

/** Lifecycle of a charge; mirrors `payments.status`. */
export type PaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED'
  /** Held by the webhook: stale checkout session or amount mismatch. */
  | 'REQUIRES_REVIEW';

/** Payment flag on a BRC expediente; mirrors `brc_expedientes.payment_status`. */
export type ExpedientePaymentStatus =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'EXENTO'
  | 'REEMBOLSADO';

/**
 * Full price breakdown of a BRC certificate, in two planes.
 *
 * ACCOUNTING (internal): `total = subtotal + iva + gatewayFee`. The gateway
 * fee is the Stripe commission TRANSFERRED to the customer (gross-up), so
 * BitHauss always nets `subtotal + iva`. Stored on the payment row for
 * reconciliation against Stripe's settlement report.
 *
 * PRESENTATION (customer-facing): the commission is ABSORBED into the service
 * price and never itemised, so the customer sees only
 * `displaySubtotal + displayIva = total`.
 */
export interface BrcPriceBreakdown {
  /**
   * INTERNAL — do not render. Official tariff for the bracket, before
   * discounts; it excludes the absorbed commission.
   */
  base: number;
  /** INTERNAL — do not render. Membership discount on the base. */
  discount: number;
  /** INTERNAL — do not render. base − discount. */
  subtotal: number;
  /** INTERNAL — do not render. VAT over the internal subtotal. */
  iva: number;
  /**
   * INTERNAL — MUST NOT BE RENDERED OR SERIALISED TO THE CLIENT.
   * Payment-gateway commission passed on to the customer inside the price.
   */
  gatewayFee: number;
  /** Amount charged to the card. Safe to show. */
  total: number;
  /** Customer-facing list price, commission included. */
  displayBase: number;
  /** Customer-facing membership discount, grossed up in the same proportion. */
  displayDiscount: number;
  /** Customer-facing service line: `total ÷ (1 + ivaRate)`. */
  displaySubtotal: number;
  /** Customer-facing VAT line: `total − displaySubtotal`. */
  displayIva: number;
  /** Always 'MXN': the tariff table is published in pesos. */
  currency: string;
  /** e.g. "Certificado BRC · De 5 a 10 mdp". */
  tariffLabel: string;
  /** e.g. "De $5,000,000 a $10,000,000 MXN". */
  valueRangeLabel: string;
  /** Bracket id, e.g. 'DE_5_10M'. */
  bracketId: string;
  /** Property value in MXN used to pick the bracket (USD is converted). */
  propertyValueMxn: number;
  /** Discount rate applied (0–1). */
  membershipDiscountPct: number;
  /** VAT rate applied (0–1). */
  ivaRate: number;
  /** False when the property has no usable price and the entry tariff is quoted. */
  hasValidPropertyValue: boolean;
}

/**
 * A row of `payments`, including the non-subscription (BRC) columns added in
 * migration 026. Named `PaymentRecord` because `membership.types.ts` already
 * exports a narrower `Payment` for subscription charges.
 */
export interface PaymentRecord {
  id: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  /** Owner of the charge. Null only on legacy rows. */
  profile_id: string | null;
  /** Set for membership charges. */
  subscription_id: string | null;
  /** Set for BRC certificate charges. */
  expediente_id: string | null;
  property_id: string | null;
  /** Charged amount; mirrors `total_amount`. */
  amount: number;
  currency: string;
  base_amount: number | null;
  discount_amount: number;
  subtotal_amount: number | null;
  iva_amount: number | null;
  iva_rate: number | null;
  /** Internal: kept for reconciliation, never shown to the customer. */
  gateway_fee_amount: number | null;
  total_amount: number | null;
  /** Customer-facing service line as it was displayed at checkout. */
  display_subtotal_amount: number | null;
  /** Customer-facing VAT line as it was displayed at checkout. */
  display_iva_amount: number | null;
  /** Property value (MXN) the quote was computed with; audit trail. */
  quoted_property_value_mxn: number | null;
  /** Why the payment was held for manual review, when applicable. */
  review_reason: string | null;
  membership_tier: string | null;
  membership_discount_pct: number;
  tariff_bracket: string | null;
  payment_method: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Customer-safe projection of the breakdown: the accounting plane (the
 * gateway commission above all) is stripped before it crosses the wire.
 */
export type BrcClientBreakdown = Omit<
  BrcPriceBreakdown,
  'base' | 'discount' | 'subtotal' | 'iva' | 'gatewayFee'
>;

/** Response of `POST /payments/brc/checkout`. */
export interface BrcCheckoutSession {
  /** Stripe-hosted checkout URL to redirect the browser to. */
  url: string;
  payment_id: string;
  session_id: string;
  /** Server-computed amount. The client never sends one. */
  amount: number;
  currency: string;
  breakdown: BrcClientBreakdown;
}
