import { MembershipTier, SubscriptionStatus } from './enums';

/**
 * Membership plan offered by the platform.
 */
export interface MembershipPlan {
  id: string;
  tier: MembershipTier;
  name: string;
  description: string | null;
  price_monthly: number; // MXN
  price_yearly: number | null; // MXN (discount)
  max_properties: number | null; // null = unlimited
  max_users: number | null;
  features: string[]; // JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payment record.
 */
export interface Payment {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  payment_method: string | null; // 'stripe' | 'transfer' | 'crypto'
  stripe_payment_intent_id: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paid_at: string | null;
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
  created_at: string;
  updated_at: string;
}
