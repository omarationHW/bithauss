import { createHmac } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateBrcCheckoutDto } from './dto';
import {
  StripeClient,
  StripeSignatureError,
  type CreateCheckoutSessionParams,
} from './stripe.client';

/* ------------------------------------------------------------------ */
/*  Supabase mock                                                      */
/* ------------------------------------------------------------------ */

type Canned = { data?: unknown; error?: unknown };

interface MockOptions {
  /** Response returned by select-chains, per table. */
  reads?: Record<string, Canned>;
  /** Response returned by insert-chains, per table. */
  inserts?: Record<string, Canned>;
  /** Response returned by update-chains, per table. */
  updates?: Record<string, Canned>;
}

interface MockSupabase {
  from: jest.Mock;
  insertCalls: { table: string; payload: Record<string, unknown> }[];
  updateCalls: { table: string; payload: Record<string, unknown> }[];
}

function makeSupabase(opts: MockOptions = {}): MockSupabase {
  const insertCalls: { table: string; payload: Record<string, unknown> }[] = [];
  const updateCalls: { table: string; payload: Record<string, unknown> }[] = [];

  const from = jest.fn((table: string) => {
    const read: Canned = opts.reads?.[table] ?? { data: null, error: null };
    const insert: Canned = opts.inserts?.[table] ?? { data: null, error: null };
    const update: Canned = opts.updates?.[table] ?? { data: null, error: null };

    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() => Promise.resolve(read));
    chain.single = jest.fn(() => Promise.resolve(read));
    // Awaiting the chain without .single()/.maybeSingle() is a LIST read
    // (`getMembershipTier` fetches every active subscription, since a PLATINO
    // client may hold several). A canned object is wrapped in a one-row list
    // so the existing fixtures keep describing "one subscription".
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data:
          read.data === null || read.data === undefined
            ? read.data
            : Array.isArray(read.data)
              ? read.data
              : [read.data],
        error: read.error,
      }).then(resolve);

    chain.insert = jest.fn((payload: Record<string, unknown>) => {
      insertCalls.push({ table, payload });
      const insertChain: Record<string, unknown> = {};
      insertChain.select = jest.fn(() => insertChain);
      insertChain.single = jest.fn(() => Promise.resolve(insert));
      // Awaiting the insert directly (no .select()) resolves to the same canned value.
      insertChain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(insert).then(resolve);
      return insertChain;
    });

    chain.update = jest.fn((payload: Record<string, unknown>) => {
      updateCalls.push({ table, payload });
      const updateChain: Record<string, unknown> = {};
      updateChain.eq = jest.fn(() => Promise.resolve(update));
      return updateChain;
    });

    return chain;
  });

  return { from, insertCalls, updateCalls };
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EXPEDIENTE_ID = '22222222-2222-4222-8222-222222222222';
const PROPERTY_ID = '33333333-3333-4333-8333-333333333333';
const PAYMENT_ID = '44444444-4444-4444-8444-444444444444';
const WEBHOOK_SECRET = 'whsec_test';

function baseReads(overrides: Record<string, Canned> = {}): Record<string, Canned> {
  return {
    brc_expedientes: {
      data: {
        id: EXPEDIENTE_ID,
        property_id: PROPERTY_ID,
        requested_by: USER_ID,
        status: 'BORRADOR',
      },
    },
    properties: {
      data: {
        id: PROPERTY_ID,
        title: 'Casa en Polanco',
        price: 3_000_000,
        price_sale: null,
        currency: 'MXN',
      },
    },
    subscriptions: { data: null },
    // No pending payment yet → the service inserts one.
    payments: { data: null },
    ...overrides,
  };
}

function makeStripeStub() {
  const calls: CreateCheckoutSessionParams[] = [];
  return {
    calls,
    isConfigured: jest.fn(() => true),
    isWebhookConfigured: jest.fn(() => true),
    createCheckoutSession: jest.fn(async (params: CreateCheckoutSessionParams) => {
      calls.push(params);
      return {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        payment_intent: 'pi_test_123',
      };
    }),
    constructEvent: jest.fn(),
    expireCheckoutSession: jest.fn(async () => true),
  };
}

function makeService(
  supabase: MockSupabase,
  stripe: unknown = makeStripeStub(),
): PaymentsService {
  const supabaseConfig = {
    getAdminClient: () => supabase as never,
    getClientForUser: () => supabase as never,
  };
  const config = {
    get: (key: string) =>
      key === 'FRONTEND_URL' ? 'https://app.bithauss.com' : undefined,
  };
  return new PaymentsService(
    supabaseConfig as never,
    stripe as never,
    config as never,
  );
}

/* ------------------------------------------------------------------ */
/*  Checkout — server-side amount                                      */
/* ------------------------------------------------------------------ */

describe('PaymentsService.createBrcCheckout', () => {
  it('computes the amount on the server from the property value', async () => {
    const supabase = makeSupabase({
      reads: baseReads(),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const stripe = makeStripeStub();
    const service = makeService(supabase, stripe);

    const result = await service.createBrcCheckout(USER_ID, {
      expediente_id: EXPEDIENTE_ID,
    });

    // 3 mdp → base 10,000 + IVA 1,600 → grossed up for Stripe = 12,109.16
    expect(result.amount).toBe(12_109.16);
    expect(result.url).toContain('checkout.stripe.com');

    // The customer-facing plane absorbs the commission and reconciles.
    expect(result.breakdown.displaySubtotal).toBe(10_438.93);
    expect(result.breakdown.displayIva).toBe(1_670.23);
    expect(
      result.breakdown.displaySubtotal + result.breakdown.displayIva,
    ).toBeCloseTo(result.amount, 2);

    // The accounting plane never leaves the server.
    const serialised = JSON.parse(JSON.stringify(result));
    expect(serialised.breakdown).not.toHaveProperty('gatewayFee');
    expect(serialised.breakdown).not.toHaveProperty('base');
    expect(serialised.breakdown).not.toHaveProperty('subtotal');

    // Stripe is charged in integer centavos.
    expect(stripe.calls[0]!.lineItem.unitAmount).toBe(1_210_916);
    expect(stripe.calls[0]!.lineItem.currency).toBe('MXN');
  });

  it('persists the full breakdown on the payment row', async () => {
    const supabase = makeSupabase({
      reads: baseReads(),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    await service.createBrcCheckout(USER_ID, { expediente_id: EXPEDIENTE_ID });

    const insert = supabase.insertCalls.find((c) => c.table === 'payments');
    expect(insert).toBeDefined();
    expect(insert!.payload).toMatchObject({
      profile_id: USER_ID,
      expediente_id: EXPEDIENTE_ID,
      property_id: PROPERTY_ID,
      subscription_id: null,
      payment_type: 'BRC_CERTIFICADO',
      status: 'PENDING',
      base_amount: 10_000,
      discount_amount: 0,
      subtotal_amount: 10_000,
      iva_amount: 1_600,
      total_amount: 12_109.16,
      currency: 'MXN',
      tariff_bracket: 'HASTA_5M',
      quoted_property_value_mxn: 3_000_000,
      // Hidden from the customer, stored for reconciliation.
      gateway_fee_amount: 509.16,
      display_subtotal_amount: 10_438.93,
      display_iva_amount: 1_670.23,
    });
  });

  it('ignores any amount the client tries to send', async () => {
    const supabase = makeSupabase({
      reads: baseReads(),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const stripe = makeStripeStub();
    const service = makeService(supabase, stripe);

    // A tampered client sending a 1-peso total must change nothing.
    const tampered = {
      expediente_id: EXPEDIENTE_ID,
      amount: 1,
      total: 1,
      total_amount: 1,
      base_amount: 1,
      membershipDiscountPct: 0.99,
    } as unknown as CreateBrcCheckoutDto;

    const result = await service.createBrcCheckout(USER_ID, tampered);
    expect(result.amount).toBe(12_109.16);
    expect(result.breakdown.displayDiscount).toBe(0);
    expect(stripe.calls[0]!.lineItem.unitAmount).toBe(1_210_916);
  });

  it('rejects a body carrying an amount at the validation layer', async () => {
    // Mirrors the global pipe configured in main.ts.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        { expediente_id: EXPEDIENTE_ID, amount: 1 },
        { type: 'body', metatype: CreateBrcCheckoutDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The clean body still passes.
    await expect(
      pipe.transform(
        { expediente_id: EXPEDIENTE_ID },
        { type: 'body', metatype: CreateBrcCheckoutDto },
      ),
    ).resolves.toMatchObject({ expediente_id: EXPEDIENTE_ID });
  });

  it('reads the membership discount from the database, not from the client', async () => {
    const supabase = makeSupabase({
      reads: baseReads({
        subscriptions: {
          data: { status: 'ACTIVA', membership_plans: { tier: 'PLATINO' } },
        },
      }),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    const result = await service.createBrcCheckout(USER_ID, {
      expediente_id: EXPEDIENTE_ID,
    });

    // Internal plane: 15% of the 10,000 base.
    const insert = supabase.insertCalls.find((c) => c.table === 'payments');
    expect(insert!.payload).toMatchObject({
      base_amount: 10_000,
      discount_amount: 1_500,
      subtotal_amount: 8_500,
    });
    // Customer plane: the discount survives, the commission stays hidden.
    expect(result.breakdown.membershipDiscountPct).toBe(0.15);
    expect(result.breakdown.displayDiscount).toBeGreaterThan(0);
    expect(
      result.breakdown.displayBase - result.breakdown.displayDiscount,
    ).toBeCloseTo(result.breakdown.displaySubtotal, 2);
  });

  it('A6: con membresías acumuladas cobra el MEJOR nivel, no el primero', async () => {
    // Un cliente PLATINO puede acumular membresías adicionales (A6), así que
    // `subscriptions` tiene varias filas ACTIVA. Leer "la primera" devolvía una
    // arbitraria — a menudo la barata — y cotizaba 5% a quien tiene 15%.
    const supabase = makeSupabase({
      reads: baseReads({
        subscriptions: {
          data: [
            { status: 'ACTIVA', tier: 'GOLD', membership_plans: { tier: 'GOLD' } },
            { status: 'ACTIVA', tier: 'PLATINO', membership_plans: { tier: 'PLATINO' } },
          ],
        },
      }),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    const result = await service.createBrcCheckout(USER_ID, {
      expediente_id: EXPEDIENTE_ID,
    });

    expect(result.breakdown.membershipDiscountPct).toBe(0.15);
    const insert = supabase.insertCalls.find((c) => c.table === 'payments');
    expect(insert!.payload).toMatchObject({
      membership_tier: 'PLATINO',
      discount_amount: 1_500,
    });
  });

  it('la columna denormalizada `subscriptions.tier` (029) manda sobre el embed', async () => {
    // 029 desnormalizó `tier` en subscriptions precisamente para que editar el
    // catálogo no reescriba el historial. Si ambas existen, gana la columna.
    const supabase = makeSupabase({
      reads: baseReads({
        subscriptions: {
          data: { status: 'ACTIVA', tier: 'BLACK', membership_plans: { tier: 'START' } },
        },
      }),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    const result = await service.createBrcCheckout(USER_ID, {
      expediente_id: EXPEDIENTE_ID,
    });

    expect(result.breakdown.membershipDiscountPct).toBe(0.1);
  });

  it('sin `tier` denormalizado sigue resolviendo por el embed del plan', async () => {
    const supabase = makeSupabase({
      reads: baseReads({
        subscriptions: {
          data: { status: 'ACTIVA', tier: null, membership_plans: { tier: 'GOLD' } },
        },
      }),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    const result = await service.createBrcCheckout(USER_ID, {
      expediente_id: EXPEDIENTE_ID,
    });

    expect(result.breakdown.membershipDiscountPct).toBe(0.05);
  });

  it('prices a USD listing through the MXN tariff table', async () => {
    const supabase = makeSupabase({
      reads: baseReads({
        properties: {
          data: {
            id: PROPERTY_ID,
            title: 'Depa en Cancún',
            price: null,
            price_sale: 1_000_000,
            currency: 'USD',
          },
        },
      }),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    const result = await service.createBrcCheckout(USER_ID, {
      expediente_id: EXPEDIENTE_ID,
    });

    // 1M USD × 18.5 = 18.5 mdp → "De 10 a 20 mdp"
    expect(result.breakdown.bracketId).toBe('DE_10_20M');
    const insert = supabase.insertCalls.find((c) => c.table === 'payments');
    expect(insert!.payload.base_amount).toBe(20_000);
  });

  it('refreshes the existing PENDING payment instead of creating another', async () => {
    const supabase = makeSupabase({
      reads: baseReads({ payments: { data: { id: PAYMENT_ID } } }),
    });
    const service = makeService(supabase);
    await service.createBrcCheckout(USER_ID, { expediente_id: EXPEDIENTE_ID });

    expect(supabase.insertCalls.filter((c) => c.table === 'payments')).toHaveLength(0);
    expect(
      supabase.updateCalls.filter((c) => c.table === 'payments').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('stores the checkout session id on the payment', async () => {
    const supabase = makeSupabase({
      reads: baseReads(),
      inserts: { payments: { data: { id: PAYMENT_ID } } },
    });
    const service = makeService(supabase);
    await service.createBrcCheckout(USER_ID, { expediente_id: EXPEDIENTE_ID });

    expect(supabase.updateCalls).toContainEqual({
      table: 'payments',
      payload: { stripe_checkout_session_id: 'cs_test_123' },
    });
  });
});

describe('PaymentsService.createBrcCheckout · access control', () => {
  it('403s when the caller does not own the expediente', async () => {
    const supabase = makeSupabase({
      reads: baseReads({
        brc_expedientes: {
          data: {
            id: EXPEDIENTE_ID,
            property_id: PROPERTY_ID,
            requested_by: 'someone-else',
            status: 'BORRADOR',
          },
        },
      }),
    });
    await expect(
      makeService(supabase).createBrcCheckout(USER_ID, {
        expediente_id: EXPEDIENTE_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s when the expediente does not exist', async () => {
    const supabase = makeSupabase({
      reads: baseReads({ brc_expedientes: { data: null } }),
    });
    await expect(
      makeService(supabase).createBrcCheckout(USER_ID, {
        expediente_id: EXPEDIENTE_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('503s when Stripe is not configured', async () => {
    const supabase = makeSupabase({ reads: baseReads() });
    const stripe = makeStripeStub();
    stripe.isConfigured.mockReturnValue(false);
    await expect(
      makeService(supabase, stripe).createBrcCheckout(USER_ID, {
        expediente_id: EXPEDIENTE_ID,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Webhook                                                            */
/* ------------------------------------------------------------------ */

function realStripeClient(): StripeClient {
  const config = {
    get: (key: string) =>
      key === 'STRIPE_WEBHOOK_SECRET'
        ? WEBHOOK_SECRET
        : key === 'STRIPE_SECRET_KEY'
          ? 'sk_test'
          : undefined,
  };
  return new StripeClient(config as never);
}

function signedEvent(
  event: Record<string, unknown>,
  timestampOffset = 0,
): { body: string; header: string } {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000) + timestampOffset;
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');
  return { body, header: `t=${timestamp},v1=${signature}` };
}

const SESSION_ID = 'cs_test_123';

/** The payment row as the webhook finds it: quoted at 3 mdp, still pending. */
function pendingPaymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    status: 'PENDING',
    expediente_id: EXPEDIENTE_ID,
    property_id: PROPERTY_ID,
    profile_id: USER_ID,
    currency: 'MXN',
    total_amount: 12_109.16,
    membership_discount_pct: 0,
    tariff_bracket: 'HASTA_5M',
    stripe_checkout_session_id: SESSION_ID,
    ...overrides,
  };
}

/** The property as it stands NOW, when the webhook recomputes the price. */
function propertyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPERTY_ID,
    title: 'Casa en Polanco',
    price: 3_000_000,
    price_sale: null,
    currency: 'MXN',
    ...overrides,
  };
}

function webhookReads(overrides: Record<string, Canned> = {}): Record<string, Canned> {
  return {
    payments: { data: pendingPaymentRow() },
    properties: { data: propertyRow() },
    ...overrides,
  };
}

function sessionEvent(
  session: Record<string, unknown> = {},
  event: Record<string, unknown> = {},
) {
  return {
    id: 'evt_completed_1',
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    ...event,
    data: {
      object: {
        id: SESSION_ID,
        client_reference_id: EXPEDIENTE_ID,
        payment_intent: 'pi_test_123',
        payment_status: 'paid',
        amount_total: 1_210_916, // 12,109.16 MXN in centavos
        currency: 'mxn',
        metadata: {
          payment_id: PAYMENT_ID,
          expediente_id: EXPEDIENTE_ID,
          profile_id: USER_ID,
        },
        ...session,
      },
    },
  };
}

describe('PaymentsService.handleWebhook · signature and idempotency', () => {
  it('credits the payment and unlocks the expediente on a valid paid session', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent());

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ received: true, handled: true, credited: true });

    const paymentUpdate = supabase.updateCalls.find((c) => c.table === 'payments');
    expect(paymentUpdate!.payload).toMatchObject({
      status: 'COMPLETED',
      stripe_payment_intent_id: 'pi_test_123',
      quoted_property_value_mxn: 3_000_000,
      tariff_bracket: 'HASTA_5M',
    });
    expect(paymentUpdate!.payload.paid_at).toBeTruthy();

    const expedienteUpdate = supabase.updateCalls.find(
      (c) => c.table === 'brc_expedientes',
    );
    expect(expedienteUpdate!.payload).toMatchObject({ payment_status: 'PAGADO' });
  });

  it('rejects an invalid signature without touching the database', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body } = signedEvent(sessionEvent());

    await expect(
      service.handleWebhook(
        body,
        `t=${Math.floor(Date.now() / 1000)},v1=${'a'.repeat(64)}`,
      ),
    ).rejects.toBeInstanceOf(StripeSignatureError);
    expect(supabase.updateCalls).toHaveLength(0);
    expect(supabase.insertCalls).toHaveLength(0);
  });

  it('rejects a replayed event whose timestamp is outside the tolerance', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent(), -3_600);

    await expect(service.handleWebhook(body, header)).rejects.toThrow(/tolerance/i);
    expect(supabase.updateCalls).toHaveLength(0);
  });

  it('is idempotent: a redelivered event is not processed twice', async () => {
    // The unique index on stripe_event_id rejects the second insert.
    const supabase = makeSupabase({
      reads: webhookReads(),
      inserts: { stripe_webhook_events: { error: { code: '23505' } } },
    });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent());

    const result = await service.handleWebhook(body, header);
    expect(result).toEqual({ received: true, duplicate: true });
    expect(supabase.updateCalls).toHaveLength(0);
  });

  it('does not re-credit a payment that is already COMPLETED', async () => {
    const supabase = makeSupabase({
      reads: webhookReads({
        payments: { data: pendingPaymentRow({ status: 'COMPLETED' }) },
      }),
    });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent({}, { id: 'evt_replay_1' }));

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: false, alreadyCompleted: true });
    expect(supabase.updateCalls).toHaveLength(0);
  });

  it('records the event id before processing it', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent());

    await service.handleWebhook(body, header);
    const claim = supabase.insertCalls.find(
      (c) => c.table === 'stripe_webhook_events',
    );
    expect(claim!.payload).toMatchObject({
      stripe_event_id: 'evt_completed_1',
      type: 'checkout.session.completed',
    });
  });

  it('acknowledges unknown event types without side effects', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(
      sessionEvent({}, { id: 'evt_other_1', type: 'customer.created' }),
    );

    const result = await service.handleWebhook(body, header);
    expect(result).toEqual({ received: true, handled: false });
    expect(supabase.updateCalls).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  BH-29 · Asynchronous payment methods (OXXO / SPEI)                 */
/* ------------------------------------------------------------------ */

describe('PaymentsService.handleWebhook · BH-29 payment_status gate', () => {
  it('does NOT credit a completed session whose payment_status is unpaid', async () => {
    // OXXO: the voucher exists, the money does not.
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(
      sessionEvent({ payment_status: 'unpaid' }),
    );

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: false, awaitingPayment: true });

    // The payment stays pending and the expediente stays locked.
    const paymentUpdate = supabase.updateCalls.find((c) => c.table === 'payments');
    expect(paymentUpdate!.payload).toMatchObject({ status: 'PENDING' });
    expect(
      supabase.updateCalls.find((c) => c.table === 'brc_expedientes'),
    ).toBeUndefined();
  });

  it('credits when the async payment later succeeds', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(
      sessionEvent(
        { payment_status: 'paid' },
        { id: 'evt_async_ok', type: 'checkout.session.async_payment_succeeded' },
      ),
    );

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: true });
    expect(
      supabase.updateCalls.find((c) => c.table === 'payments')!.payload,
    ).toMatchObject({ status: 'COMPLETED' });
    expect(
      supabase.updateCalls.find((c) => c.table === 'brc_expedientes')!.payload,
    ).toMatchObject({ payment_status: 'PAGADO' });
  });

  it('marks the payment failed when the async payment fails', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(
      sessionEvent(
        { payment_status: 'unpaid' },
        { id: 'evt_async_ko', type: 'checkout.session.async_payment_failed' },
      ),
    );

    await service.handleWebhook(body, header);
    expect(supabase.updateCalls).toContainEqual({
      table: 'payments',
      payload: { status: 'FAILED' },
    });
    expect(
      supabase.updateCalls.find((c) => c.table === 'brc_expedientes'),
    ).toBeUndefined();
  });

  it('marks the payment failed when the session expires unpaid', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(
      sessionEvent(
        { payment_status: 'unpaid' },
        { id: 'evt_expired', type: 'checkout.session.expired' },
      ),
    );

    await service.handleWebhook(body, header);
    expect(supabase.updateCalls).toContainEqual({
      table: 'payments',
      payload: { status: 'FAILED' },
    });
  });

  it('does not fail a payment that already cleared', async () => {
    const supabase = makeSupabase({
      reads: webhookReads({
        payments: { data: pendingPaymentRow({ status: 'COMPLETED' }) },
      }),
    });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(
      sessionEvent({}, { id: 'evt_late_fail', type: 'payment_intent.payment_failed' }),
    );

    await service.handleWebhook(body, header);
    expect(supabase.updateCalls).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  BH-28 · Stale session / re-priced property                         */
/* ------------------------------------------------------------------ */

describe('PaymentsService.handleWebhook · BH-28 amount and session gates', () => {
  it('refuses a session paid after the property was re-priced upward', async () => {
    // Quoted at 3 mdp (12,109.16) — the property is now worth 45 mdp, whose
    // tariff is 50,000 + IVA. Paying the old session must not certify it.
    const supabase = makeSupabase({
      reads: webhookReads({
        properties: { data: propertyRow({ price: 45_000_000 }) },
      }),
    });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent());

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: false, requiresReview: true });
    expect(result.reason).toMatch(/precio actual/);

    const paymentUpdate = supabase.updateCalls.find((c) => c.table === 'payments');
    expect(paymentUpdate!.payload).toMatchObject({ status: 'REQUIRES_REVIEW' });
    expect(paymentUpdate!.payload.review_reason).toEqual(expect.any(String));
    // The expediente is NOT unlocked.
    expect(
      supabase.updateCalls.find((c) => c.table === 'brc_expedientes'),
    ).toBeUndefined();
  });

  it('refuses a session that is no longer the live quote', async () => {
    const supabase = makeSupabase({
      reads: webhookReads({
        payments: {
          data: pendingPaymentRow({ stripe_checkout_session_id: 'cs_new_456' }),
        },
      }),
    });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent()); // pays cs_test_123

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: false, requiresReview: true });
    expect(result.reason).toMatch(/obsoleta/i);
    expect(
      supabase.updateCalls.find((c) => c.table === 'brc_expedientes'),
    ).toBeUndefined();
  });

  it('refuses when Stripe charged less than the quoted amount', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent({ amount_total: 100 }));

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: false, requiresReview: true });
  });

  it('refuses when the session reports no amount at all', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent({ amount_total: null }));

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: false, requiresReview: true });
    expect(result.reason).toMatch(/amount_total/);
  });

  it('tolerates a one-centavo rounding difference', async () => {
    const supabase = makeSupabase({ reads: webhookReads() });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent({ amount_total: 1_210_915 }));

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: true });
  });

  it('keeps crediting when the membership lapsed after the quote', async () => {
    // The stored discount is what was quoted; a membership that expired in
    // the meantime must not look like tampering.
    const supabase = makeSupabase({
      reads: webhookReads({
        payments: {
          data: pendingPaymentRow({
            membership_discount_pct: 0.15,
            total_amount: 10_293.33,
          }),
        },
      }),
    });
    const service = makeService(supabase, realStripeClient());
    const { body, header } = signedEvent(sessionEvent({ amount_total: 1_029_333 }));

    const result = await service.handleWebhook(body, header);
    expect(result).toMatchObject({ credited: true });
  });

  it('expires the previous checkout session when the quote is refreshed', async () => {
    const supabase = makeSupabase({
      reads: baseReads({
        payments: { data: { id: PAYMENT_ID, stripe_checkout_session_id: 'cs_old_1' } },
      }),
    });
    const stripe = makeStripeStub();
    const service = makeService(supabase, stripe);

    await service.createBrcCheckout(USER_ID, { expediente_id: EXPEDIENTE_ID });

    expect(stripe.expireCheckoutSession).toHaveBeenCalledWith('cs_old_1');
    // The stale session id is cleared before the new one is written.
    const refresh = supabase.updateCalls.find(
      (c) => c.table === 'payments' && 'stripe_checkout_session_id' in c.payload,
    );
    expect(refresh!.payload.stripe_checkout_session_id).toBeNull();
  });
});
