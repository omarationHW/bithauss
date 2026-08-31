import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  MEMBERSHIP_IVA_RATE,
  MEMBERSHIP_TRIAL_DAYS,
  getPlan,
  getPlanPricing,
  listMembershipPlans,
  type MembershipPeriodKey,
  type MembershipTierKey,
} from '@bithauss/config';

import { SupabaseConfigService } from '../../config/supabase.config';
import {
  computeEntitlements,
  canCreateCrmSeat,
  canPublishProperty,
  daysRemaining,
  evaluateUpgrade,
  findStackingAnchor,
  isEffective,
  isTrialActive,
  legalTicketsAvailable,
  termEndFrom,
  trialEndFrom,
  type Entitlements,
  type SubscriptionLike,
} from './membership.rules';
import type {
  ConfirmCancellationDto,
  ConfirmPaymentDto,
  ConsumeLegalTicketDto,
  ContractMembershipDto,
  CreateCrmSeatDto,
  RecordPaymentDto,
  RequestCancellationDto,
  StackMembershipDto,
  StartTrialDto,
  UpgradeMembershipDto,
} from './dto/memberships.dto';

export interface SubscriptionRow extends SubscriptionLike {
  profile_id: string;
  company_id: string | null;
  plan_id: string;
  current_period_start: string;
  payment_confirmed_by: string | null;
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
  cancellation_confirmed_by: string | null;
  payment_mode: string;
}

export interface MembershipSummary {
  subscriptions: SubscriptionRow[];
  entitlements: Entitlements;
  usage: {
    propertiesPublished: number;
    crmSeatsUsed: number;
    legalTicketsUsed: number;
  };
  daysRemaining: number;
  trialDaysRemaining: number;
}

/**
 * Memberships — the money side of the platform.
 *
 * Two rules drive almost every method here and are worth stating up front:
 *
 *   A5. Nothing is activated by a single actor. Recording a payment and
 *       confirming it are separate calls, made by different people; the same
 *       applies to cancelling an account for non-payment. A service that
 *       "helpfully" collapses the two steps defeats the control entirely.
 *
 *   A6. Only PLATINO accumulates. Upgrades go up, never down: a downgrade is
 *       a cancellation plus a new contract, and is refused here rather than
 *       silently reinterpreted.
 */
@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  private get db(): SupabaseClient {
    return this.supabaseConfig.getAdminClient();
  }

  // ────────────────────────────────────────────────────────────
  // Catálogo
  // ────────────────────────────────────────────────────────────

  /**
   * The 6 × 4 catalogue, straight from @bithauss/config rather than the
   * database: the PDF is the source of truth, and a mis-seeded row must not
   * be able to quote a price BitHauss never published.
   */
  getCatalog() {
    return {
      currency: 'MXN',
      iva_rate: MEMBERSHIP_IVA_RATE,
      prices_include_iva: false,
      trial_days: MEMBERSHIP_TRIAL_DAYS,
      tiers: listMembershipPlans(),
    };
  }

  // ────────────────────────────────────────────────────────────
  // Consulta
  // ────────────────────────────────────────────────────────────

  async getMyMembership(
    profileId: string,
    now: Date = new Date(),
  ): Promise<MembershipSummary> {
    const subscriptions = await this.listSubscriptions(profileId);
    const entitlements = computeEntitlements(subscriptions, now);

    const primary =
      subscriptions.find((s) => !s.parent_subscription_id && isEffective(s, now)) ??
      subscriptions.find((s) => isEffective(s, now)) ??
      subscriptions[0];

    const usage = await this.getUsage(subscriptions.map((s) => s.id), profileId);

    return {
      subscriptions,
      entitlements,
      usage,
      daysRemaining: primary ? daysRemaining(primary.current_period_end, now) : 0,
      trialDaysRemaining:
        primary && isTrialActive(primary, now)
          ? daysRemaining(primary.trial_ends_at, now)
          : 0,
    };
  }

  private async listSubscriptions(profileId: string): Promise<SubscriptionRow[]> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('*')
      .eq('profile_id', profileId);

    if (error) {
      this.logger.error(`listSubscriptions failed: ${error.message}`);
      throw new InternalServerErrorException(
        'No se pudieron consultar tus membresías.',
      );
    }
    return (data ?? []) as SubscriptionRow[];
  }

  private async getSubscription(id: string): Promise<SubscriptionRow> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        'No se pudo consultar la suscripción.',
      );
    }
    if (!data) {
      throw new NotFoundException('Suscripción no encontrada.');
    }
    return data as SubscriptionRow;
  }

  /**
   * Usage counters. `membership_usage` is a cache; properties are counted
   * from the source table so the limit can never be bypassed by a stale row.
   */
  private async getUsage(subscriptionIds: string[], profileId: string) {
    const { count: propertiesPublished } = await this.db
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', profileId)
      .eq('status', 'PUBLICADO');

    if (subscriptionIds.length === 0) {
      return {
        propertiesPublished: propertiesPublished ?? 0,
        crmSeatsUsed: 0,
        legalTicketsUsed: 0,
      };
    }

    const { count: crmSeatsUsed } = await this.db
      .from('membership_crm_seats')
      .select('id', { count: 'exact', head: true })
      .in('subscription_id', subscriptionIds)
      .eq('is_active', true);

    const { count: legalTicketsUsed } = await this.db
      .from('membership_legal_tickets')
      .select('id', { count: 'exact', head: true })
      .in('subscription_id', subscriptionIds)
      .eq('status', 'USADO');

    return {
      propertiesPublished: propertiesPublished ?? 0,
      crmSeatsUsed: crmSeatsUsed ?? 0,
      legalTicketsUsed: legalTicketsUsed ?? 0,
    };
  }

  private async findPlanId(
    tier: MembershipTierKey,
    period: MembershipPeriodKey,
  ): Promise<string> {
    const { data, error } = await this.db
      .from('membership_plans')
      .select('id')
      .eq('tier', tier)
      .eq('period', period)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('No se pudo leer el catálogo.');
    }
    if (!data) {
      throw new NotFoundException(
        `El plan ${tier} · ${period} no está disponible.`,
      );
    }
    return (data as { id: string }).id;
  }

  // ────────────────────────────────────────────────────────────
  // A1/A3/A4 · Contratación
  // ────────────────────────────────────────────────────────────

  /**
   * Contracting always lands in PENDIENTE_PAGO. Access is granted only once a
   * second actor confirms the payment (A5) — never as a side effect of this
   * call, whatever the gateway says.
   */
  async contract(
    profileId: string,
    dto: ContractMembershipDto,
    now: Date = new Date(),
  ) {
    const paymentMode = dto.payment_mode ?? 'UNICO';

    if (dto.period === 'ANUAL_ANTICIPADO' && paymentMode !== 'UNICO') {
      throw new BadRequestException(
        'El Plan Anual con precio especial se paga en una sola exhibición.',
      );
    }

    const existing = await this.listSubscriptions(profileId);
    const active = existing.filter((s) => isEffective(s, now));
    if (active.length > 0) {
      throw new BadRequestException(
        'Ya cuentas con una membresía vigente. Usa el upgrade o, si tienes PLATINO, acumula una membresía adicional.',
      );
    }

    const planId = await this.findPlanId(dto.tier, dto.period);
    const pricing = getPlanPricing(dto.tier, dto.period);

    return this.insertSubscription({
      profile_id: profileId,
      company_id: dto.company_id ?? null,
      plan_id: planId,
      tier: dto.tier,
      period: dto.period,
      status: 'PENDIENTE_PAGO',
      payment_mode: paymentMode,
      current_period_start: now.toISOString(),
      current_period_end: termEndFrom(dto.period, now).toISOString(),
      trial_ends_at: null,
      parent_subscription_id: null,
      amount: pricing.total,
    });
  }

  /**
   * A2 — 7 natural days of trial with 1 CRM seat and 3 properties.
   * The card is a hard requirement: when the trial ends the selected plan is
   * charged unless the client cancels, so a trial without a card on file is
   * a giveaway, not a trial.
   */
  async startTrial(
    profileId: string,
    dto: StartTrialDto,
    now: Date = new Date(),
  ) {
    if (!dto.payment_method_id) {
      throw new BadRequestException(
        'Para iniciar los 7 días de prueba se requiere una tarjeta registrada.',
      );
    }

    const existing = await this.listSubscriptions(profileId);
    if (existing.length > 0) {
      throw new BadRequestException(
        'La prueba de 7 días es sólo para clientes que aún no conocen BitHauss.',
      );
    }

    const planId = await this.findPlanId(dto.tier, dto.period);

    return this.insertSubscription({
      profile_id: profileId,
      company_id: dto.company_id ?? null,
      plan_id: planId,
      tier: dto.tier,
      period: dto.period,
      status: 'PRUEBA',
      payment_mode: 'UNICO',
      current_period_start: now.toISOString(),
      // The paid term only starts when the trial ends and the charge lands.
      current_period_end: trialEndFrom(now).toISOString(),
      trial_ends_at: trialEndFrom(now).toISOString(),
      parent_subscription_id: null,
      amount: null,
    });
  }

  /**
   * A6 — upgrade. Refuses downgrades (cancel + new contract) and leaves the
   * new subscription in PENDIENTE_PAGO until the payment is double-verified.
   */
  async upgrade(
    profileId: string,
    dto: UpgradeMembershipDto,
    now: Date = new Date(),
  ) {
    const current = await this.getSubscription(dto.subscription_id);
    if (current.profile_id !== profileId) {
      throw new ForbiddenException('Esta suscripción no te pertenece.');
    }

    const decision = evaluateUpgrade(current.tier, dto.target_tier);
    if (!decision.allowed) {
      throw new BadRequestException(decision.reason);
    }

    const planId = await this.findPlanId(dto.target_tier, dto.target_period);
    const pricing = getPlanPricing(dto.target_tier, dto.target_period);

    return this.insertSubscription({
      profile_id: profileId,
      company_id: current.company_id,
      plan_id: planId,
      tier: dto.target_tier,
      period: dto.target_period,
      status: 'PENDIENTE_PAGO',
      payment_mode: current.payment_mode ?? 'UNICO',
      current_period_start: now.toISOString(),
      current_period_end: termEndFrom(dto.target_period, now).toISOString(),
      trial_ends_at: null,
      parent_subscription_id: null,
      amount: pricing.total,
      supersedes: current.id,
    });
  }

  /**
   * A6 — accumulate an extra membership onto a PLATINO one.
   * "6 PLATINO + 5 BLACK → 800 + 500 = 1,300 propiedades pagando el precio de
   * ambas membresías y acumulando conceptos incluidos."
   */
  async stack(
    profileId: string,
    dto: StackMembershipDto,
    now: Date = new Date(),
  ) {
    const subs = await this.listSubscriptions(profileId);
    const parent = subs.find((s) => s.id === dto.parent_subscription_id);

    if (!parent) {
      throw new NotFoundException('La membresía base no existe.');
    }
    if (parent.profile_id !== profileId) {
      throw new ForbiddenException('Esta suscripción no te pertenece.');
    }

    const anchor = findStackingAnchor([parent], now);
    if (!anchor) {
      throw new BadRequestException(
        'Sólo la Membresía 6 PLATINO vigente permite acumular membresías adicionales.',
      );
    }

    const planId = await this.findPlanId(dto.tier, dto.period);
    const pricing = getPlanPricing(dto.tier, dto.period);

    return this.insertSubscription({
      profile_id: profileId,
      company_id: parent.company_id,
      plan_id: planId,
      tier: dto.tier,
      period: dto.period,
      status: 'PENDIENTE_PAGO',
      payment_mode: parent.payment_mode ?? 'UNICO',
      current_period_start: now.toISOString(),
      current_period_end: termEndFrom(dto.period, now).toISOString(),
      trial_ends_at: null,
      parent_subscription_id: parent.id,
      amount: pricing.total,
    });
  }

  private async insertSubscription(input: {
    profile_id: string;
    company_id: string | null;
    plan_id: string;
    tier: MembershipTierKey;
    period: MembershipPeriodKey;
    status: string;
    payment_mode: string;
    current_period_start: string;
    current_period_end: string;
    trial_ends_at: string | null;
    parent_subscription_id: string | null;
    amount: number | null;
    supersedes?: string;
  }) {
    const { amount, supersedes, ...row } = input;

    const { data, error } = await this.db
      .from('subscriptions')
      .insert(row)
      .select()
      .single();

    if (error) {
      this.logger.error(`insertSubscription failed: ${error.message}`);
      throw new InternalServerErrorException(
        'No se pudo registrar la membresía.',
      );
    }

    const created = data as SubscriptionRow;

    if (amount !== null) {
      // The pending payment row exists from the start so the admin queue has
      // something to confirm, and so the amount owed is never recomputed from
      // a plan that may have been re-priced in the meantime.
      const { error: payError } = await this.db.from('payments').insert({
        subscription_id: created.id,
        amount,
        tax_amount: Math.round(amount * MEMBERSHIP_IVA_RATE * 100) / 100,
        currency: 'MXN',
        status: 'PENDING',
      });
      if (payError) {
        this.logger.error(`payment row failed: ${payError.message}`);
      }
    }

    if (supersedes) {
      // The previous membership stays readable but stops granting anything as
      // soon as the upgrade is confirmed; it is cancelled here so the client
      // is never billed twice.
      await this.db
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', supersedes);
    }

    return created;
  }

  // ────────────────────────────────────────────────────────────
  // A5 · Doble verificación de pago
  // ────────────────────────────────────────────────────────────

  /** Step 1 — the operator (or the gateway webhook) records the payment. */
  async recordPayment(actorId: string, dto: RecordPaymentDto) {
    const subscription = await this.getSubscription(dto.subscription_id);

    const { data, error } = await this.db
      .from('payments')
      .insert({
        subscription_id: subscription.id,
        amount: dto.amount,
        tax_amount: Math.round(dto.amount * MEMBERSHIP_IVA_RATE * 100) / 100,
        currency: 'MXN',
        payment_method: dto.payment_method ?? 'stripe',
        stripe_payment_intent_id: dto.stripe_payment_intent_id ?? null,
        instalment_number: dto.instalment_number ?? null,
        status: 'COMPLETED',
        paid_at: new Date().toISOString(),
        recorded_by: actorId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`recordPayment failed: ${error.message}`);
      throw new InternalServerErrorException('No se pudo registrar el pago.');
    }

    // Deliberately does NOT activate the subscription. A5 requires a second
    // actor's confirmation before access is authorised.
    return {
      payment: data,
      subscription_status: subscription.status,
      requires_confirmation: true,
    };
  }

  /**
   * Step 2 — a *different* admin confirms, and only then does the
   * subscription become ACTIVA.
   */
  async confirmPayment(
    adminId: string,
    dto: ConfirmPaymentDto,
    now: Date = new Date(),
  ) {
    if (dto.confirm !== true) {
      throw new BadRequestException(
        'La confirmación de pago debe ser explícita.',
      );
    }

    const subscription = await this.getSubscription(dto.subscription_id);

    if (subscription.payment_confirmed_at) {
      throw new BadRequestException('Este pago ya fue confirmado.');
    }

    const payment = await this.findConfirmablePayment(
      subscription.id,
      dto.payment_id,
    );

    if (!payment) {
      throw new BadRequestException(
        'No hay un pago registrado para esta suscripción. Registra el pago antes de confirmarlo.',
      );
    }

    if (payment.recorded_by && payment.recorded_by === adminId) {
      throw new ForbiddenException(
        'La doble verificación exige que el pago sea confirmado por una persona distinta a quien lo registró.',
      );
    }

    const nowIso = now.toISOString();

    const { error: payError } = await this.db
      .from('payments')
      .update({ confirmed_by: adminId, confirmed_at: nowIso })
      .eq('id', payment.id);

    if (payError) {
      throw new InternalServerErrorException('No se pudo confirmar el pago.');
    }

    // The paid term starts when access is granted, not when the client
    // clicked "contratar": a slow confirmation must not eat their days.
    const start = now;
    const end = termEndFrom(subscription.period, start);

    const { data, error } = await this.db
      .from('subscriptions')
      .update({
        status: 'ACTIVA',
        payment_confirmed_by: adminId,
        payment_confirmed_at: nowIso,
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        trial_ends_at: null,
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        'No se pudo activar la membresía.',
      );
    }

    await this.grantLegalTickets(subscription, end);

    return data;
  }

  private async findConfirmablePayment(
    subscriptionId: string,
    paymentId?: string,
  ): Promise<{ id: string; recorded_by: string | null } | null> {
    const query = this.db
      .from('payments')
      .select('id, recorded_by, status, confirmed_at')
      .eq('subscription_id', subscriptionId)
      .eq('status', 'COMPLETED');

    const { data, error } = paymentId
      ? await query.eq('id', paymentId).maybeSingle()
      : await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (error) {
      throw new InternalServerErrorException('No se pudo leer el pago.');
    }
    return (data as { id: string; recorded_by: string | null } | null) ?? null;
  }

  /**
   * Tickets are granted at activation, not at contracting, and only on the
   * prepaid annual plan of BLACK / PLATINO. They expire with the term.
   */
  private async grantLegalTickets(
    subscription: SubscriptionRow,
    expiresAt: Date,
  ) {
    if (subscription.period !== 'ANUAL_ANTICIPADO') return;

    const count = getPlan(subscription.tier).legalTickets;
    if (count === 0) return;

    const rows = Array.from({ length: count }, () => ({
      subscription_id: subscription.id,
      profile_id: subscription.profile_id,
      status: 'DISPONIBLE',
      expires_at: expiresAt.toISOString(),
    }));

    const { error } = await this.db
      .from('membership_legal_tickets')
      .insert(rows);

    if (error) {
      this.logger.error(`grantLegalTickets failed: ${error.message}`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // A5 · Doble verificación de cancelación
  // ────────────────────────────────────────────────────────────

  async requestCancellation(adminId: string, dto: RequestCancellationDto) {
    const subscription = await this.getSubscription(dto.subscription_id);

    const { data, error } = await this.db
      .from('subscriptions')
      .update({
        cancellation_requested_by: adminId,
        cancellation_requested_at: new Date().toISOString(),
        cancellation_reason: dto.reason,
        // Suspended, not cancelled: the account is frozen while the second
        // admin reviews, and can be restored without a new contract.
        status: 'SUSPENDIDA',
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        'No se pudo solicitar la cancelación.',
      );
    }
    return data;
  }

  async confirmCancellation(adminId: string, dto: ConfirmCancellationDto) {
    if (dto.confirm !== true) {
      throw new BadRequestException(
        'La cancelación debe confirmarse explícitamente.',
      );
    }

    const subscription = await this.getSubscription(dto.subscription_id);

    if (!subscription.cancellation_requested_by) {
      throw new BadRequestException(
        'No existe una solicitud de cancelación previa para esta suscripción.',
      );
    }

    if (subscription.cancellation_requested_by === adminId) {
      throw new ForbiddenException(
        'La cancelación debe ser autorizada por un administrador distinto a quien la solicitó.',
      );
    }

    const { data, error } = await this.db
      .from('subscriptions')
      .update({
        status: 'CANCELADA',
        cancellation_confirmed_by: adminId,
        cancellation_confirmed_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        'No se pudo cancelar la membresía.',
      );
    }
    return data;
  }

  // ────────────────────────────────────────────────────────────
  // Enforcement
  // ────────────────────────────────────────────────────────────

  /**
   * Server-side property limit. The web app hides the button; this is the
   * control. Call it before persisting a PUBLICADO property.
   */
  async assertCanPublishProperty(
    profileId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const summary = await this.getMyMembership(profileId, now);

    if (summary.entitlements.propertyLimit === 0) {
      throw new ForbiddenException(
        'Necesitas una membresía vigente para publicar propiedades.',
      );
    }

    if (
      !canPublishProperty(
        summary.entitlements,
        summary.usage.propertiesPublished,
      )
    ) {
      throw new ForbiddenException(
        `Alcanzaste el límite de ${summary.entitlements.propertyLimit} propiedades publicadas de tu membresía. ` +
          'Haz upgrade de nivel o, si cuentas con PLATINO, acumula una membresía adicional.',
      );
    }
  }

  async createCrmSeat(
    profileId: string,
    dto: CreateCrmSeatDto,
    now: Date = new Date(),
  ) {
    const summary = await this.getMyMembership(profileId, now);
    const owns = summary.subscriptions.some(
      (s) => s.id === dto.subscription_id,
    );
    if (!owns) {
      throw new ForbiddenException('Esta suscripción no te pertenece.');
    }

    if (!canCreateCrmSeat(summary.entitlements, summary.usage.crmSeatsUsed)) {
      throw new ForbiddenException(
        `Tu membresía incluye ${summary.entitlements.crmSeats} cuentas de acceso al CRM y ya están asignadas.`,
      );
    }

    const { data, error } = await this.db
      .from('membership_crm_seats')
      .insert({
        subscription_id: dto.subscription_id,
        email: dto.email,
        full_name: dto.full_name ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        'No se pudo crear la cuenta de CRM (¿el correo ya está registrado?).',
      );
    }
    return data;
  }

  /** Spends one legal-consultation ticket. */
  async consumeLegalTicket(
    profileId: string,
    dto: ConsumeLegalTicketDto,
    now: Date = new Date(),
  ) {
    const summary = await this.getMyMembership(profileId, now);

    if (summary.entitlements.legalTicketsGranted === 0) {
      throw new ForbiddenException(
        'Los tickets de consultas jurídicas aplican únicamente en las membresías BLACK y PLATINO pagando por anticipado el Plan Anual.',
      );
    }

    if (
      legalTicketsAvailable(
        summary.entitlements,
        summary.usage.legalTicketsUsed,
      ) === 0
    ) {
      throw new ForbiddenException('Ya usaste todos tus tickets jurídicos.');
    }

    const { data: ticket, error: findError } = await this.db
      .from('membership_legal_tickets')
      .select('id')
      .eq('subscription_id', dto.subscription_id)
      .eq('profile_id', profileId)
      .eq('status', 'DISPONIBLE')
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw new InternalServerErrorException('No se pudo leer tus tickets.');
    }
    if (!ticket) {
      throw new ForbiddenException('No tienes tickets jurídicos disponibles.');
    }

    const { data, error } = await this.db
      .from('membership_legal_tickets')
      .update({
        status: 'USADO',
        subject: dto.subject,
        used_at: now.toISOString(),
      })
      .eq('id', (ticket as { id: string }).id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException('No se pudo usar el ticket.');
    }
    return data;
  }

  // ────────────────────────────────────────────────────────────
  // A5 · Reporte diario de status
  // ────────────────────────────────────────────────────────────

  /**
   * "El Sistema BitHauss deberá emitir reportes diarios de status de cada
   * cliente y status general para seguimiento."
   *
   * Reads the `membership_status_report` view (029) and adds the aggregate
   * counters the general status needs. The mailing/WhatsApp job consumes this.
   */
  async getDailyStatusReport(now: Date = new Date()) {
    const { data, error } = await this.db
      .from('membership_status_report')
      .select('*')
      .order('current_period_end', { ascending: true });

    if (error) {
      this.logger.error(`daily report failed: ${error.message}`);
      throw new InternalServerErrorException(
        'No se pudo generar el reporte diario.',
      );
    }

    const rows = (data ?? []) as Array<{
      status: string;
      days_remaining: number;
      payment_confirmed: boolean;
      trial_ends_at: string | null;
    }>;

    const byStatus: Record<string, number> = {};
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    }

    return {
      generated_at: now.toISOString(),
      total: rows.length,
      by_status: byStatus,
      // The three queues a human actually works every morning.
      awaiting_payment_confirmation: rows.filter(
        (r) => r.status === 'PENDIENTE_PAGO' && !r.payment_confirmed,
      ).length,
      trials_ending: rows.filter(
        (r) => r.status === 'PRUEBA' && r.days_remaining <= 2,
      ).length,
      expiring_in_30_days: rows.filter(
        (r) =>
          r.status === 'ACTIVA' &&
          r.days_remaining > 0 &&
          r.days_remaining <= 30,
      ).length,
      rows,
    };
  }
}
