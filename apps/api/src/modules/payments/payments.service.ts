import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfigService } from '../../config/supabase.config';
import { CreateBrcCheckoutDto } from './dto';
import {
  StripeClient,
  StripeSignatureError,
  type StripeEvent,
} from './stripe.client';
import {
  bestMembershipTier,
  calculateBrcPrice,
  membershipDiscountFor,
  toClientBreakdown,
  toStripeMinorUnits,
  type BrcClientBreakdown,
  type BrcPriceBreakdown,
} from './brc-pricing';

/** Postgres unique-violation — how a duplicate webhook announces itself. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Ceiling on the ACTIVE subscriptions read to resolve a discount. A6 caps
 * stacking at PLATINO + extras for a single client, so this is a guard against
 * a runaway read, never a business rule.
 */
const MAX_ACTIVE_SUBSCRIPTIONS = 20;

/** One `subscriptions` row as the tier lookup selects it. */
interface SubscriptionTierRow {
  tier?: string | null;
  membership_plans?: { tier?: string | null } | { tier?: string | null }[] | null;
}

/**
 * Tier of one subscription row: the denormalised column first (029), the
 * embedded plan as the fallback. PostgREST returns a many-to-one embed as an
 * object, but returns an array when it cannot prove the cardinality, so both
 * shapes are handled.
 */
function subscriptionTier(row: SubscriptionTierRow): string | null {
  if (row.tier) return row.tier;
  const plan = row.membership_plans;
  const embedded = Array.isArray(plan) ? plan[0]?.tier : plan?.tier;
  return embedded ?? null;
}

/**
 * How far the charged amount may sit from the recomputed price before the
 * payment is held for review: one centavo. Both sides round to cents, so a
 * single minor unit is the entire legitimate margin — anything larger is a
 * price change between quote and payment, not rounding.
 */
const AMOUNT_TOLERANCE_MINOR = 1;

/** Columns of `payments` the webhook needs to decide whether to credit. */
interface PaymentRow {
  id: string;
  status: string;
  expediente_id: string | null;
  property_id: string | null;
  profile_id: string | null;
  currency: string | null;
  total_amount: number | null;
  membership_discount_pct: number | null;
  tariff_bracket: string | null;
  stripe_checkout_session_id: string | null;
}

export interface WebhookResult {
  received: boolean;
  /** The event id had already been processed. */
  duplicate?: boolean;
  /** The event type is one this module acts on. */
  handled?: boolean;
  /** Money confirmed and the expediente unlocked. */
  credited?: boolean;
  /** The payment row was already COMPLETED. */
  alreadyCompleted?: boolean;
  /** Voucher issued (OXXO/SPEI) but no funds yet. */
  awaitingPayment?: boolean;
  /** Held for a human: stale session or amount mismatch. */
  requiresReview?: boolean;
  reason?: string;
}

export interface BrcCheckoutResult {
  url: string;
  payment_id: string;
  session_id: string;
  amount: number;
  currency: string;
  /**
   * Customer-facing plane only. The accounting plane — the gateway
   * commission in particular — is persisted on the payment row but never
   * serialised to the browser.
   */
  breakdown: BrcClientBreakdown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabaseConfig: SupabaseConfigService,
    private readonly stripe: StripeClient,
    private readonly config: ConfigService,
  ) {}

  /** First origin of the (possibly comma-separated) FRONTEND_URL allowlist. */
  private get frontendUrl(): string {
    const raw = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return (raw.split(',')[0] ?? raw).trim().replace(/\/$/, '');
  }

  /**
   * Membership tier of the requester, or null. Read here (server-side) so a
   * client cannot claim a PLATINO discount it does not have.
   *
   * `membership_plans(tier)` is an embed through `subscriptions.plan_id`, so
   * it resolves ONE plan row even though migration 028 moved the catalogue's
   * uniqueness from `(tier)` to `(tier, period)` and there are now four rows
   * per tier. The denormalised `subscriptions.tier` (migration 029) is read
   * first and the embed is the fallback, so the lookup still works on a
   * database where 029 has not back-filled a legacy row.
   *
   * Every ACTIVE subscription is fetched, not just the first: A6 lets a
   * PLATINO client stack extra memberships, and `.limit(1)` would have
   * returned an arbitrary one of them.
   */
  private async getMembershipTier(profileId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, tier, membership_plans(tier)')
      .eq('profile_id', profileId)
      .eq('status', 'ACTIVA')
      .limit(MAX_ACTIVE_SUBSCRIPTIONS);

    if (error || !data) return null;

    const rows = (Array.isArray(data) ? data : [data]) as SubscriptionTierRow[];
    return bestMembershipTier(rows.map(subscriptionTier));
  }

  /**
   * Creates (or refreshes) the pending payment for a BRC expediente and
   * returns a Stripe Checkout URL.
   *
   * SECURITY: the amount is computed here from the property price and the
   * caller's membership. Nothing about the price is accepted from the client
   * — `CreateBrcCheckoutDto` carries only the expediente id.
   */
  async createBrcCheckout(
    userId: string,
    dto: CreateBrcCheckoutDto,
  ): Promise<BrcCheckoutResult> {
    if (!userId) throw new UnauthorizedException('Sesión inválida');
    if (!this.stripe.isConfigured()) {
      throw new ServiceUnavailableException(
        'El pago en línea aún no está configurado. Contáctanos para completar tu pago.',
      );
    }

    const supabase = this.supabaseConfig.getAdminClient();

    const { data: expediente, error: expError } = await supabase
      .from('brc_expedientes')
      .select('id, property_id, requested_by, status')
      .eq('id', dto.expediente_id)
      .maybeSingle();

    if (expError || !expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }
    // Only the owner of the request may pay for it.
    if (expediente.requested_by !== userId) {
      throw new ForbiddenException('No puedes pagar este expediente');
    }

    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, title, price, price_sale, currency')
      .eq('id', expediente.property_id)
      .maybeSingle();

    if (propError || !property) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    const tier = await this.getMembershipTier(userId);
    const breakdown = calculateBrcPrice({
      price: property.price as number | null,
      price_sale: property.price_sale as number | null,
      currency: property.currency as string | null,
      membershipDiscountPct: membershipDiscountFor(tier),
    });

    const paymentId = await this.upsertPendingPayment(
      userId,
      expediente.id as string,
      property.id as string,
      tier,
      breakdown,
    );

    const session = await this.stripe.createCheckoutSession({
      lineItem: {
        name: breakdown.tariffLabel,
        description: `Certificación BRC · ${property.title as string}`,
        unitAmount: toStripeMinorUnits(breakdown.total),
        currency: breakdown.currency,
        quantity: 1,
      },
      successUrl: `${this.frontendUrl}/dashboard/expedientes?pago=exitoso&expediente=${expediente.id}`,
      cancelUrl: `${this.frontendUrl}/dashboard/expedientes?pago=cancelado&expediente=${expediente.id}`,
      clientReferenceId: expediente.id as string,
      metadata: {
        payment_id: paymentId,
        expediente_id: expediente.id as string,
        property_id: property.id as string,
        profile_id: userId,
      },
      // Retrying the same quote must not create a second session.
      idempotencyKey: `brc-checkout-${paymentId}-${toStripeMinorUnits(breakdown.total)}`,
    });

    if (!session?.url) {
      throw new InternalServerErrorException(
        'Stripe no devolvió una URL de pago',
      );
    }

    await supabase
      .from('payments')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', paymentId);

    return {
      url: session.url,
      payment_id: paymentId,
      session_id: session.id,
      amount: breakdown.total,
      currency: breakdown.currency,
      breakdown: toClientBreakdown(breakdown),
    };
  }

  /**
   * Keeps a single PENDING row per expediente: a user who abandons checkout
   * and comes back should refresh the amounts, not pile up rows.
   */
  private async upsertPendingPayment(
    profileId: string,
    expedienteId: string,
    propertyId: string,
    tier: string | null,
    breakdown: BrcPriceBreakdown,
  ): Promise<string> {
    const supabase = this.supabaseConfig.getAdminClient();

    const amounts = {
      amount: breakdown.total,
      currency: breakdown.currency,
      base_amount: breakdown.base,
      discount_amount: breakdown.discount,
      subtotal_amount: breakdown.subtotal,
      iva_amount: breakdown.iva,
      // Kept for reconciliation against Stripe; never shown to the customer.
      gateway_fee_amount: breakdown.gatewayFee,
      total_amount: breakdown.total,
      // Customer-facing lines, stored so a receipt can be reprinted exactly
      // as it was displayed even if rates change later.
      display_subtotal_amount: breakdown.displaySubtotal,
      display_iva_amount: breakdown.displayIva,
      iva_rate: breakdown.ivaRate,
      membership_tier: tier,
      membership_discount_pct: breakdown.membershipDiscountPct,
      tariff_bracket: breakdown.bracketId,
      // Audit trail for the amount check in the webhook: what the property
      // was worth when this quote was issued.
      quoted_property_value_mxn: breakdown.propertyValueMxn,
    };

    const { data: existing } = await supabase
      .from('payments')
      .select('id, stripe_checkout_session_id')
      .eq('expediente_id', expedienteId)
      .eq('status', 'PENDING')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // Re-quoting invalidates the previous session: leaving it payable is
      // exactly the BH-28 hole (pay the old, cheaper session after the
      // property is re-priced). The webhook refuses stale sessions anyway,
      // so a failed expiry is logged, not fatal.
      const previousSession = existing.stripe_checkout_session_id as
        | string
        | null;
      if (previousSession) {
        await this.stripe.expireCheckoutSession(previousSession);
      }

      const { error } = await supabase
        .from('payments')
        .update({ ...amounts, stripe_checkout_session_id: null })
        .eq('id', existing.id as string);
      if (error) {
        throw new InternalServerErrorException('No se pudo actualizar el pago');
      }
      return existing.id as string;
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        profile_id: profileId,
        expediente_id: expedienteId,
        property_id: propertyId,
        subscription_id: null,
        payment_type: 'BRC_CERTIFICADO',
        payment_method: 'stripe_checkout',
        status: 'PENDING',
        ...amounts,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('No se pudo registrar el pago');
    }
    return data.id as string;
  }

  /* ---------------------------------------------------------------- */
  /*  Webhook                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Verifies and processes a Stripe webhook.
   *
   * Signature verification happens BEFORE anything is read from the payload:
   * an unsigned body is attacker-controlled data, not an event. Delivery is
   * at-least-once, so the event id is claimed in `stripe_webhook_events`
   * (unique) and a duplicate returns early without touching the payment.
   */
  async handleWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
  ): Promise<WebhookResult> {
    let event: StripeEvent;
    try {
      event = this.stripe.constructEvent(rawBody, signatureHeader);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid signature';
      this.logger.warn(`Rejected Stripe webhook: ${message}`);
      // Rethrown as-is; the controller maps it to a 400 so Stripe retries
      // are not mistaken for server outages.
      throw err instanceof StripeSignatureError
        ? err
        : new StripeSignatureError(message);
    }

    const claimed = await this.claimEvent(event);
    if (!claimed) {
      this.logger.log(`Duplicate Stripe event ignored: ${event.id}`);
      return { received: true, duplicate: true };
    }

    switch (event.type) {
      // `completed` fires as soon as the customer finishes the flow. For OXXO
      // and SPEI that happens when the voucher is issued — no money has moved
      // yet — so it is `payment_status` that decides, never the event name.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.creditPayment(event);
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
      case 'payment_intent.payment_failed':
        await this.markPaymentFailed(event);
        return { received: true, handled: true };
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
        return { received: true, handled: false };
    }
  }

  /**
   * Inserts the event id; returns false when it was already stored (the
   * unique index is what makes the webhook idempotent — checking-then-writing
   * would race against a concurrent redelivery).
   */
  private async claimEvent(event: StripeEvent): Promise<boolean> {
    const supabase = this.supabaseConfig.getAdminClient();
    const { error } = await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

    if (!error) return true;
    const code = (error as { code?: string }).code;
    if (code === PG_UNIQUE_VIOLATION) return false;

    this.logger.error(
      `Could not record Stripe event ${event.id}: ${JSON.stringify(error)}`,
    );
    throw new InternalServerErrorException('No se pudo registrar el evento');
  }

  /** Extracts the ids and money fields the checkout session carries back. */
  private extractRefs(event: StripeEvent): {
    paymentId?: string;
    expedienteId?: string;
    paymentIntentId?: string;
    sessionId?: string;
    /** 'paid' | 'unpaid' | 'no_payment_required' — the ONLY proof of money. */
    sessionPaymentStatus?: string;
    /** Integer minor units Stripe actually charged for. */
    amountTotal?: number;
    currency?: string;
  } {
    const object = event.data?.object ?? {};
    const metadata = (object.metadata ?? {}) as Record<string, string>;
    const paymentIntent = object.payment_intent;
    return {
      paymentId: metadata.payment_id,
      expedienteId:
        metadata.expediente_id ?? (object.client_reference_id as string | undefined),
      paymentIntentId:
        typeof paymentIntent === 'string' ? paymentIntent : undefined,
      sessionId: typeof object.id === 'string' ? object.id : undefined,
      sessionPaymentStatus:
        typeof object.payment_status === 'string' ? object.payment_status : undefined,
      amountTotal:
        typeof object.amount_total === 'number' ? object.amount_total : undefined,
      currency: typeof object.currency === 'string' ? object.currency : undefined,
    };
  }

  /**
   * Credits a checkout that Stripe reports as finished.
   *
   * Three gates stand between "Stripe called us" and "the expediente is
   * paid", because passing any one of them alone has already produced a real
   * exploit:
   *
   *  1. MONEY EXISTS (BH-29). `checkout.session.completed` fires the moment
   *     the customer finishes the flow. With OXXO/SPEI — both common in
   *     Mexico — that is when the voucher is printed, days before anyone
   *     pays, and the session can still expire unpaid. Only
   *     `payment_status === 'paid'` proves funds; anything else leaves the
   *     payment PENDING and waits for `async_payment_succeeded`.
   *
   *  2. THE SESSION IS THE CURRENT ONE (BH-28). A checkout session keeps
   *     working after the quote that produced it is gone. Opening checkout on
   *     a 4 mdp property, re-pricing the property to 45 mdp and then paying
   *     the old session would certify a 50,000 MXN tariff for 12,109 MXN. The
   *     payment row records which session is live; anything else is stale.
   *
   *  3. THE AMOUNT STILL MATCHES. The price is recomputed from the CURRENT
   *     property and compared against what Stripe charged, so a value change
   *     between quote and payment cannot slip through even if the stale
   *     session was somehow the live one.
   *
   * A failed gate never credits: the payment is parked in REQUIRES_REVIEW
   * with the reason, the expediente stays unpaid, and a human decides.
   */
  private async creditPayment(event: StripeEvent): Promise<WebhookResult> {
    const supabase = this.supabaseConfig.getAdminClient();
    const refs = this.extractRefs(event);

    const payment = await this.findPaymentForSession(refs);
    if (!payment) {
      this.logger.warn(
        `Stripe event ${event.id} has no matching payment row (session ${refs.sessionId ?? 'n/a'})`,
      );
      return { received: true, handled: true, credited: false };
    }

    // Second layer of idempotency: a replay that slipped past the event table
    // (different event id, same session) must not re-credit.
    if (payment.status === 'COMPLETED') {
      return { received: true, handled: true, credited: false, alreadyCompleted: true };
    }

    // ---- Gate 1: is there money? ----
    if (refs.sessionPaymentStatus !== 'paid') {
      this.logger.log(
        `Session ${refs.sessionId ?? 'n/a'} finished with payment_status=` +
          `${refs.sessionPaymentStatus ?? 'unknown'}; awaiting async payment`,
      );
      await this.updatePayment(payment.id, {
        status: 'PENDING',
        stripe_payment_intent_id: refs.paymentIntentId ?? null,
      });
      return {
        received: true,
        handled: true,
        credited: false,
        awaitingPayment: true,
      };
    }

    // ---- Gate 2: is this the live session? ----
    if (
      payment.stripe_checkout_session_id &&
      refs.sessionId &&
      payment.stripe_checkout_session_id !== refs.sessionId
    ) {
      return this.flagForReview(
        payment.id,
        `Sesión obsoleta: se pagó ${refs.sessionId} pero la vigente es ${payment.stripe_checkout_session_id}`,
      );
    }

    // ---- Gate 3: does the amount still match today's price? ----
    const verdict = await this.verifyChargedAmount(payment, refs);
    if (!verdict.ok) {
      return this.flagForReview(payment.id, verdict.reason);
    }

    const paidAt = new Date().toISOString();
    await this.updatePayment(payment.id, {
      status: 'COMPLETED',
      paid_at: paidAt,
      stripe_payment_intent_id: refs.paymentIntentId ?? null,
      // Audit trail: what the property was worth when the charge cleared.
      quoted_property_value_mxn: verdict.propertyValueMxn ?? null,
      tariff_bracket: verdict.bracketId ?? payment.tariff_bracket ?? null,
    });

    const expedienteId = payment.expediente_id ?? refs.expedienteId;
    if (expedienteId) {
      // Unlock the expediente. The BRC state machine belongs to another
      // module, so only the payment flag is touched — best effort, never
      // fatal: the money is captured and the payment row is the record.
      const { error: expError } = await supabase
        .from('brc_expedientes')
        .update({ payment_status: 'PAGADO', paid_at: paidAt })
        .eq('id', expedienteId);

      if (expError) {
        this.logger.warn(
          `Payment recorded but expediente ${expedienteId} flag not updated: ${JSON.stringify(expError)}`,
        );
      }
    }

    return { received: true, handled: true, credited: true };
  }

  /**
   * Resolves the payment row from the event, preferring the session id over
   * the metadata: metadata is copied into the session at creation time and
   * could be stale, the session id is what the row actually points at.
   */
  private async findPaymentForSession(refs: {
    paymentId?: string;
    sessionId?: string;
  }): Promise<PaymentRow | null> {
    const supabase = this.supabaseConfig.getAdminClient();
    const columns =
      'id, status, expediente_id, property_id, profile_id, currency, ' +
      'total_amount, membership_discount_pct, tariff_bracket, stripe_checkout_session_id';

    if (refs.sessionId) {
      const { data } = await supabase
        .from('payments')
        .select(columns)
        .eq('stripe_checkout_session_id', refs.sessionId)
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as PaymentRow;
    }

    if (refs.paymentId) {
      const { data } = await supabase
        .from('payments')
        .select(columns)
        .eq('id', refs.paymentId)
        .limit(1)
        .maybeSingle();
      if (data) return data as unknown as PaymentRow;
    }

    return null;
  }

  /**
   * Recomputes the price from the property AS IT IS NOW and checks it against
   * what Stripe charged.
   *
   * The stored membership discount is reused on purpose: the discount was
   * fixed, server-side, when the quote was issued, so a membership that
   * lapsed in the meantime must not be read as tampering. The property value
   * is the only moving part this gate is meant to catch.
   *
   * Tolerance is one centavo: both sides round to cents, so a legitimate
   * charge can differ by a single minor unit and nothing more.
   */
  private async verifyChargedAmount(
    payment: PaymentRow,
    refs: { amountTotal?: number; currency?: string },
  ): Promise<{
    ok: boolean;
    reason: string;
    propertyValueMxn?: number;
    bracketId?: string;
  }> {
    const supabase = this.supabaseConfig.getAdminClient();

    if (typeof refs.amountTotal !== 'number') {
      return { ok: false, reason: 'La sesión de Stripe no reporta amount_total' };
    }

    if (!payment.property_id) {
      return { ok: false, reason: 'El pago no tiene propiedad asociada' };
    }

    const { data: property } = await supabase
      .from('properties')
      .select('id, price, price_sale, currency')
      .eq('id', payment.property_id)
      .limit(1)
      .maybeSingle();

    if (!property) {
      return { ok: false, reason: 'La propiedad ya no existe' };
    }

    const expected = calculateBrcPrice({
      price: property.price as number | null,
      price_sale: property.price_sale as number | null,
      currency: property.currency as string | null,
      membershipDiscountPct: Number(payment.membership_discount_pct ?? 0),
    });

    const expectedMinor = toStripeMinorUnits(expected.total);
    const storedMinor =
      payment.total_amount === null || payment.total_amount === undefined
        ? null
        : toStripeMinorUnits(Number(payment.total_amount));

    if (Math.abs(refs.amountTotal - expectedMinor) > AMOUNT_TOLERANCE_MINOR) {
      return {
        ok: false,
        reason:
          `Monto cobrado ${refs.amountTotal} ≠ precio actual ${expectedMinor} ` +
          `(bracket ${expected.bracketId}, valor ${expected.propertyValueMxn} MXN)`,
      };
    }

    if (
      storedMinor !== null &&
      Math.abs(refs.amountTotal - storedMinor) > AMOUNT_TOLERANCE_MINOR
    ) {
      return {
        ok: false,
        reason: `Monto cobrado ${refs.amountTotal} ≠ monto cotizado ${storedMinor}`,
      };
    }

    return {
      ok: true,
      reason: '',
      propertyValueMxn: expected.propertyValueMxn,
      bracketId: expected.bracketId,
    };
  }

  /** Parks a suspicious payment for a human instead of crediting it. */
  private async flagForReview(
    paymentId: string,
    reason: string,
  ): Promise<WebhookResult> {
    this.logger.error(`Payment ${paymentId} held for manual review: ${reason}`);
    await this.updatePayment(paymentId, {
      status: 'REQUIRES_REVIEW',
      review_reason: reason.slice(0, 500),
    });
    return {
      received: true,
      handled: true,
      credited: false,
      requiresReview: true,
      reason,
    };
  }

  private async updatePayment(
    paymentId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();
    const { error } = await supabase
      .from('payments')
      .update(payload)
      .eq('id', paymentId);
    if (error) {
      this.logger.error(
        `Could not update payment ${paymentId}: ${JSON.stringify(error)}`,
      );
      throw new InternalServerErrorException('No se pudo actualizar el pago');
    }
  }

  /**
   * Marks the payment as failed. Reached by `async_payment_failed` (the OXXO
   * voucher expired unpaid), `session.expired` and a failed PaymentIntent —
   * all of which mean the pending charge will never clear.
   */
  private async markPaymentFailed(event: StripeEvent): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();
    const refs = this.extractRefs(event);
    const payment = await this.findPaymentForSession(refs);
    const paymentId = payment?.id ?? refs.paymentId;
    if (!paymentId) return;

    // A payment that already cleared is not un-done by a later failure event.
    if (payment?.status === 'COMPLETED') return;

    const { error } = await supabase
      .from('payments')
      .update({ status: 'FAILED' })
      .eq('id', paymentId);

    if (error) {
      this.logger.error(
        `Could not fail payment ${paymentId}: ${JSON.stringify(error)}`,
      );
    }
  }
}
