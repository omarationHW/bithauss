import { MembershipPeriod, MembershipTier, SubscriptionStatus } from './enums';

/**
 * One sellable membership plan: a (tier, period) pair.
 *
 * The catalogue holds 24 rows — six tiers × four contract lengths — because
 * BitHauss prices each contract length separately (Módulo Membresías, A3/A4).
 * `tier` alone is therefore NOT unique; `(tier, period)` is.
 */
export interface MembershipPlan {
  id: string;
  tier: MembershipTier;
  period: MembershipPeriod;
  name: string;
  description: string | null;
  /** Total contract price in MXN, before IVA. */
  price_total: number;
  /**
   * A4 — monthly direct-debit instalment, or null for the prepaid annual
   * plan. Note instalment × count is intentionally higher than `price_total`:
   * paying monthly costs more than paying the contract up front.
   */
  price_monthly_instalment: number | null;
  /** 3, 6 or 12; null when the plan is a single up-front payment. */
  instalment_count: number | null;
  /** Contract length in months (3 / 6 / 12). */
  duration_months: number;
  max_properties: number;
  /** CRM seats included ("cuentas de acceso al CRM inmobiliario"). */
  max_crm_seats: number;
  brc_discount_pct: number;
  video_discount_pct: number;
  /** Tickets granted by this plan — 0 unless the plan is prepaid annual. */
  legal_tickets: number;
  has_certified_professionals_network: boolean;
  has_notary_network: boolean;
  has_legal_forms_library: boolean;
  /** A6 — true only for PLATINO plans. */
  allows_stacking: boolean;
  features: string[]; // JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;

  /** @deprecated legacy MVP columns kept for historical subscriptions. */
  price_monthly?: number;
  /** @deprecated legacy MVP columns kept for historical subscriptions. */
  price_yearly?: number | null;
  /** @deprecated superseded by `max_crm_seats`. */
  max_users?: number | null;
}

/**
 * Active subscription binding a user/company to a plan.
 */
export interface Subscription {
  id: string;
  profile_id: string;
  company_id: string | null;
  plan_id: string;
  status: SubscriptionStatus;
  /** Denormalised from the plan so entitlement maths never needs a join. */
  tier: MembershipTier;
  period: MembershipPeriod;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;

  /** A2 — end of the 7-day free trial; null when the trial never applied. */
  trial_ends_at: string | null;

  /**
   * A5 — double verification. The first actor records the payment; a second
   * actor (admin) confirms it here before access is granted. A subscription
   * in PENDIENTE_PAGO with `payment_confirmed_by = null` must not be
   * activated, no matter how many times the first actor retries.
   */
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;

  /**
   * A5 — the mirror check for cancellation due to non-payment: an admin has to
   * confirm before the account is actually cancelled.
   */
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
  cancellation_confirmed_by: string | null;
  cancellation_confirmed_at: string | null;
  cancellation_reason: string | null;

  /**
   * A6 — stacking. A child subscription points at the PLATINO subscription it
   * accumulates onto; the parent itself has `parent_subscription_id = null`.
   */
  parent_subscription_id: string | null;

  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Legal-consultation ticket granted by a BLACK / PLATINO prepaid annual plan.
 */
export interface LegalTicket {
  id: string;
  subscription_id: string;
  profile_id: string;
  status: 'DISPONIBLE' | 'USADO' | 'EXPIRADO';
  subject: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * Payment record.
 */
export interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  /** Amount of IVA charged on top of `amount`, when invoiced. */
  tax_amount: number | null;
  payment_method: string | null; // 'stripe' | 'transfer' | 'crypto' | 'domiciliacion'
  stripe_payment_intent_id: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  /** Which instalment of the plan this payment covers (1-based), if any. */
  instalment_number: number | null;
  paid_at: string | null;
  /** A5 — first actor: who recorded the payment. */
  recorded_by: string | null;
  /** A5 — second-actor confirmation; must differ from `recorded_by`. */
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
}

/**
 * Billing / invoicing profile for a user or company.
 */
export interface BillingProfile {
  id: string;
  profile_id: string;
  rfc: string | null;
  razon_social: string | null;
  cfdi_use: string | null;
  tax_regime: string | null;
  billing_email: string | null;
  billing_address: string | null;
  billing_zip: string | null;
  /** Masked card on file required to start the A2 trial (last 4 + brand). */
  card_brand: string | null;
  card_last4: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row of the daily status report required by A5.
 */
export interface SubscriptionStatusReportRow {
  subscription_id: string;
  profile_id: string;
  full_name: string | null;
  email: string | null;
  tier: MembershipTier;
  period: MembershipPeriod;
  status: SubscriptionStatus;
  current_period_end: string;
  days_remaining: number;
  trial_ends_at: string | null;
  payment_confirmed: boolean;
  properties_used: number;
  properties_limit: number;
}
