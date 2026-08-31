import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { MembershipsService } from './memberships.service';
import {
  computeEntitlements,
  evaluateUpgrade,
  findStackingAnchor,
  isEffective,
  termEndFrom,
  type SubscriptionLike,
} from './membership.rules';

/* ------------------------------------------------------------------ */
/*  Supabase mock                                                      */
/*  Every builder method returns the same chain; the terminals          */
/*  (single / maybeSingle / await) resolve the canned response for the  */
/*  table, so the exact call order does not matter to the test.         */
/* ------------------------------------------------------------------ */

interface Canned {
  data?: unknown;
  error?: unknown;
  count?: number;
}

interface TableSpec {
  select?: Canned;
  insert?: Canned;
  update?: Canned;
}

interface MockDb {
  from: jest.Mock;
  inserts: { table: string; payload: unknown }[];
  updates: { table: string; payload: unknown }[];
}

function makeDb(tables: Record<string, TableSpec>): MockDb {
  const inserts: { table: string; payload: unknown }[] = [];
  const updates: { table: string; payload: unknown }[] = [];

  const from = jest.fn((table: string) => {
    const spec = tables[table] ?? {};
    const selectCanned: Canned = spec.select ?? { data: null, count: 0 };

    const chain: Record<string, unknown> = {};
    const passthrough = [
      'select',
      'eq',
      'neq',
      'in',
      'order',
      'limit',
      'is',
      'gt',
      'lt',
    ];
    for (const method of passthrough) {
      chain[method] = jest.fn(() => chain);
    }
    chain.maybeSingle = jest.fn(() => Promise.resolve(selectCanned));
    chain.single = jest.fn(() => Promise.resolve(selectCanned));
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(selectCanned).then(resolve);

    chain.insert = jest.fn((payload: unknown) => {
      inserts.push({ table, payload });
      const canned: Canned = spec.insert ?? { data: payload, error: null };
      const insertChain: Record<string, unknown> = {};
      insertChain.select = jest.fn(() => insertChain);
      insertChain.single = jest.fn(() => Promise.resolve(canned));
      insertChain.maybeSingle = jest.fn(() => Promise.resolve(canned));
      insertChain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ error: canned.error ?? null }).then(resolve);
      return insertChain;
    });

    chain.update = jest.fn((payload: unknown) => {
      updates.push({ table, payload });
      const canned: Canned = spec.update ?? { data: payload, error: null };
      const updateChain: Record<string, unknown> = {};
      updateChain.eq = jest.fn(() => updateChain);
      updateChain.select = jest.fn(() => updateChain);
      updateChain.single = jest.fn(() => Promise.resolve(canned));
      updateChain.maybeSingle = jest.fn(() => Promise.resolve(canned));
      updateChain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ error: canned.error ?? null }).then(resolve);
      return updateChain;
    });

    return chain;
  });

  return { from, inserts, updates };
}

function makeService(db: MockDb): MembershipsService {
  return new MembershipsService({
    getAdminClient: () => db as never,
  } as never);
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const NOW = new Date('2026-03-01T12:00:00.000Z');
const CLIENT = '11111111-1111-1111-1111-111111111111';
const ADMIN_A = '22222222-2222-2222-2222-222222222222';
const ADMIN_B = '33333333-3333-3333-3333-333333333333';
const SUB_ID = '44444444-4444-4444-4444-444444444444';

function future(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    profile_id: CLIENT,
    company_id: null,
    plan_id: 'plan-1',
    tier: 'GOLD',
    period: 'ANUAL',
    status: 'ACTIVA',
    payment_mode: 'UNICO',
    current_period_start: future(-30),
    current_period_end: future(300),
    trial_ends_at: null,
    parent_subscription_id: null,
    payment_confirmed_by: ADMIN_B,
    payment_confirmed_at: future(-30),
    cancellation_requested_by: null,
    cancellation_requested_at: null,
    cancellation_confirmed_by: null,
    ...overrides,
  };
}

/* ================================================================== */
/*  Reglas puras (A6)                                                  */
/* ================================================================== */

describe('membership.rules · A6', () => {
  const active = (
    tier: string,
    extra: Partial<SubscriptionLike> = {},
  ): SubscriptionLike =>
    ({
      id: `s-${tier}`,
      tier,
      period: 'ANUAL',
      status: 'ACTIVA',
      current_period_end: future(200),
      payment_confirmed_at: future(-10),
      parent_subscription_id: null,
      ...extra,
    }) as SubscriptionLike;

  it('PLATINO + BLACK acumula 1,300 propiedades', () => {
    const ent = computeEntitlements(
      [active('PLATINO'), active('BLACK', { parent_subscription_id: 's-PLATINO' })],
      NOW,
    );
    expect(ent.propertyLimit).toBe(1300);
    expect(ent.crmSeats).toBe(11);
    // Percentages are never summed.
    expect(ent.brcDiscountPct).toBe(15);
  });

  it('sin PLATINO no hay acumulación: sólo cuenta la mejor membresía', () => {
    const ent = computeEntitlements([active('GOLD'), active('BLACK')], NOW);
    expect(ent.propertyLimit).toBe(500);
    expect(ent.contributingTiers).toEqual(['BLACK']);
  });

  it('rechaza el downgrade y permite el upgrade con doble verificación', () => {
    expect(evaluateUpgrade('BLACK', 'GROW').allowed).toBe(false);
    expect(evaluateUpgrade('BLACK', 'GROW').reason).toMatch(/cancelar/i);
    const up = evaluateUpgrade('GROW', 'BLACK');
    expect(up.allowed).toBe(true);
    expect(up.requiresPaymentDoubleVerification).toBe(true);
  });

  it('sólo una PLATINO vigente y no acumulada sirve de base', () => {
    expect(findStackingAnchor([active('PLATINO')], NOW)).toBeDefined();
    expect(findStackingAnchor([active('BLACK')], NOW)).toBeUndefined();
    expect(
      findStackingAnchor(
        [active('PLATINO', { parent_subscription_id: 'otra' })],
        NOW,
      ),
    ).toBeUndefined();
  });

  it('A5: sin confirmación de pago la suscripción no otorga nada', () => {
    const unconfirmed = active('PLATINO', { payment_confirmed_at: null });
    expect(isEffective(unconfirmed, NOW)).toBe(false);
    expect(computeEntitlements([unconfirmed], NOW).propertyLimit).toBe(0);
  });

  it('A3: la vigencia se calcula por meses del plan', () => {
    const start = new Date('2026-01-31T00:00:00.000Z');
    expect(termEndFrom('TRIMESTRAL', start).toISOString().slice(0, 10)).toBe(
      '2026-04-30',
    ); // se ajusta al último día del mes, no rueda a mayo
    expect(termEndFrom('ANUAL', start).getUTCFullYear()).toBe(2027);
    expect(termEndFrom('ANUAL_ANTICIPADO', start).getUTCFullYear()).toBe(2027);
  });
});

/* ================================================================== */
/*  Enforcement de límites                                             */
/* ================================================================== */

describe('MembershipsService · enforcement', () => {
  function serviceWithUsage(opts: {
    subs: unknown[];
    properties: number;
    crmSeats?: number;
    tickets?: number;
  }) {
    const db = makeDb({
      subscriptions: { select: { data: opts.subs } },
      properties: { select: { count: opts.properties, data: null } },
      membership_crm_seats: { select: { count: opts.crmSeats ?? 0, data: null } },
      membership_legal_tickets: {
        select: { count: opts.tickets ?? 0, data: null },
      },
    });
    return { db, service: makeService(db) };
  }

  it('deja publicar mientras quede cupo (GOLD = 300)', async () => {
    const { service } = serviceWithUsage({
      subs: [subscription()],
      properties: 299,
    });
    await expect(
      service.assertCanPublishProperty(CLIENT, NOW),
    ).resolves.toBeUndefined();
  });

  it('bloquea al alcanzar el límite de propiedades', async () => {
    const { service } = serviceWithUsage({
      subs: [subscription()],
      properties: 300,
    });
    await expect(service.assertCanPublishProperty(CLIENT, NOW)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('A6: con PLATINO + BLACK el límite sube a 1,300', async () => {
    const { service } = serviceWithUsage({
      subs: [
        subscription({ id: 'p', tier: 'PLATINO' }),
        subscription({ id: 'c', tier: 'BLACK', parent_subscription_id: 'p' }),
      ],
      properties: 1_299,
    });
    await expect(
      service.assertCanPublishProperty(CLIENT, NOW),
    ).resolves.toBeUndefined();
  });

  it('sin membresía vigente no se puede publicar nada', async () => {
    const { service } = serviceWithUsage({ subs: [], properties: 0 });
    await expect(service.assertCanPublishProperty(CLIENT, NOW)).rejects.toThrow(
      /membresía vigente/i,
    );
  });

  it('una suscripción PENDIENTE_PAGO no habilita publicar', async () => {
    const { service } = serviceWithUsage({
      subs: [
        subscription({
          status: 'PENDIENTE_PAGO',
          payment_confirmed_at: null,
          payment_confirmed_by: null,
        }),
      ],
      properties: 0,
    });
    await expect(service.assertCanPublishProperty(CLIENT, NOW)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('bloquea la creación de cuentas CRM por encima del plan', async () => {
    const { service } = serviceWithUsage({
      subs: [subscription()], // GOLD = 4 seats
      properties: 0,
      crmSeats: 4,
    });
    await expect(
      service.createCrmSeat(
        CLIENT,
        { subscription_id: SUB_ID, email: 'nuevo@bithauss.com' },
        NOW,
      ),
    ).rejects.toThrow(/4 cuentas/);
  });
});

/* ================================================================== */
/*  A5 · Doble verificación de pago                                    */
/* ================================================================== */

describe('MembershipsService · A5 doble verificación de pago', () => {
  const pending = subscription({
    status: 'PENDIENTE_PAGO',
    payment_confirmed_by: null,
    payment_confirmed_at: null,
  });

  it('registrar el pago NO activa la membresía por sí solo', async () => {
    const db = makeDb({
      subscriptions: { select: { data: pending } },
      payments: { insert: { data: { id: 'pay-1' }, error: null } },
    });
    const service = makeService(db);

    const result = await service.recordPayment(ADMIN_A, {
      subscription_id: SUB_ID,
      amount: 40_000,
    });

    expect(result.requires_confirmation).toBe(true);
    expect(result.subscription_status).toBe('PENDIENTE_PAGO');
    // Nothing was written to `subscriptions`: no single actor activates.
    expect(db.updates.filter((u) => u.table === 'subscriptions')).toHaveLength(0);
  });

  it('rechaza la confirmación si no hay pago registrado', async () => {
    const db = makeDb({
      subscriptions: { select: { data: pending } },
      payments: { select: { data: null } },
    });
    await expect(
      makeService(db).confirmPayment(
        ADMIN_B,
        { subscription_id: SUB_ID, confirm: true },
        NOW,
      ),
    ).rejects.toThrow(/No hay un pago registrado/);
  });

  it('rechaza que la misma persona registre y confirme', async () => {
    const db = makeDb({
      subscriptions: { select: { data: pending } },
      payments: { select: { data: { id: 'pay-1', recorded_by: ADMIN_A } } },
    });
    await expect(
      makeService(db).confirmPayment(
        ADMIN_A,
        { subscription_id: SUB_ID, confirm: true },
        NOW,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('exige que la confirmación sea explícita', async () => {
    const db = makeDb({ subscriptions: { select: { data: pending } } });
    await expect(
      makeService(db).confirmPayment(
        ADMIN_B,
        { subscription_id: SUB_ID, confirm: false },
        NOW,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('un segundo actor distinto activa la membresía y sella quién y cuándo', async () => {
    const db = makeDb({
      subscriptions: {
        select: { data: pending },
        update: { data: subscription({ status: 'ACTIVA' }), error: null },
      },
      payments: { select: { data: { id: 'pay-1', recorded_by: ADMIN_A } } },
    });
    const service = makeService(db);

    await service.confirmPayment(
      ADMIN_B,
      { subscription_id: SUB_ID, confirm: true },
      NOW,
    );

    const subUpdate = db.updates.find((u) => u.table === 'subscriptions')
      ?.payload as Record<string, unknown>;
    expect(subUpdate.status).toBe('ACTIVA');
    expect(subUpdate.payment_confirmed_by).toBe(ADMIN_B);
    expect(subUpdate.payment_confirmed_at).toBe(NOW.toISOString());

    const payUpdate = db.updates.find((u) => u.table === 'payments')
      ?.payload as Record<string, unknown>;
    expect(payUpdate.confirmed_by).toBe(ADMIN_B);
  });

  it('no vuelve a confirmar un pago ya confirmado', async () => {
    const db = makeDb({
      subscriptions: { select: { data: subscription() } },
    });
    await expect(
      makeService(db).confirmPayment(
        ADMIN_A,
        { subscription_id: SUB_ID, confirm: true },
        NOW,
      ),
    ).rejects.toThrow(/ya fue confirmado/);
  });

  it('otorga los tickets jurídicos sólo en BLACK/PLATINO anual anticipado', async () => {
    const db = makeDb({
      subscriptions: {
        select: {
          data: subscription({
            status: 'PENDIENTE_PAGO',
            tier: 'BLACK',
            period: 'ANUAL_ANTICIPADO',
            payment_confirmed_at: null,
            payment_confirmed_by: null,
          }),
        },
        update: { data: subscription({ status: 'ACTIVA' }), error: null },
      },
      payments: { select: { data: { id: 'pay-1', recorded_by: ADMIN_A } } },
      membership_legal_tickets: { insert: { data: null, error: null } },
    });
    const service = makeService(db);

    await service.confirmPayment(
      ADMIN_B,
      { subscription_id: SUB_ID, confirm: true },
      NOW,
    );

    const ticketInsert = db.inserts.find(
      (i) => i.table === 'membership_legal_tickets',
    );
    expect(ticketInsert).toBeDefined();
    expect(ticketInsert?.payload).toHaveLength(3);
  });

  it('no otorga tickets en el plan anual domiciliado', async () => {
    const db = makeDb({
      subscriptions: {
        select: {
          data: subscription({
            status: 'PENDIENTE_PAGO',
            tier: 'PLATINO',
            period: 'ANUAL',
            payment_confirmed_at: null,
            payment_confirmed_by: null,
          }),
        },
        update: { data: subscription({ status: 'ACTIVA' }), error: null },
      },
      payments: { select: { data: { id: 'pay-1', recorded_by: ADMIN_A } } },
    });
    const service = makeService(db);

    await service.confirmPayment(
      ADMIN_B,
      { subscription_id: SUB_ID, confirm: true },
      NOW,
    );

    expect(
      db.inserts.find((i) => i.table === 'membership_legal_tickets'),
    ).toBeUndefined();
  });
});

/* ================================================================== */
/*  A5 · Doble verificación de cancelación                             */
/* ================================================================== */

describe('MembershipsService · A5 doble verificación de cancelación', () => {
  it('la solicitud suspende, no cancela', async () => {
    const db = makeDb({
      subscriptions: {
        select: { data: subscription() },
        update: { data: subscription({ status: 'SUSPENDIDA' }), error: null },
      },
    });
    await makeService(db).requestCancellation(ADMIN_A, {
      subscription_id: SUB_ID,
      reason: 'Falta de pago del segundo cargo domiciliado.',
    });

    const payload = db.updates[0]?.payload as Record<string, unknown>;
    expect(payload.status).toBe('SUSPENDIDA');
    expect(payload.cancellation_requested_by).toBe(ADMIN_A);
  });

  it('no cancela sin solicitud previa', async () => {
    const db = makeDb({ subscriptions: { select: { data: subscription() } } });
    await expect(
      makeService(db).confirmCancellation(ADMIN_B, {
        subscription_id: SUB_ID,
        confirm: true,
      }),
    ).rejects.toThrow(/solicitud de cancelación previa/);
  });

  it('no permite que el mismo admin solicite y confirme', async () => {
    const db = makeDb({
      subscriptions: {
        select: {
          data: subscription({
            status: 'SUSPENDIDA',
            cancellation_requested_by: ADMIN_A,
            cancellation_requested_at: future(-1),
          }),
        },
      },
    });
    await expect(
      makeService(db).confirmCancellation(ADMIN_A, {
        subscription_id: SUB_ID,
        confirm: true,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un segundo admin sí puede cancelar', async () => {
    const db = makeDb({
      subscriptions: {
        select: {
          data: subscription({
            status: 'SUSPENDIDA',
            cancellation_requested_by: ADMIN_A,
            cancellation_requested_at: future(-1),
          }),
        },
        update: { data: subscription({ status: 'CANCELADA' }), error: null },
      },
    });
    await makeService(db).confirmCancellation(ADMIN_B, {
      subscription_id: SUB_ID,
      confirm: true,
    });

    const payload = db.updates[0]?.payload as Record<string, unknown>;
    expect(payload.status).toBe('CANCELADA');
    expect(payload.cancellation_confirmed_by).toBe(ADMIN_B);
  });
});

/* ================================================================== */
/*  A6 · Contratación, upgrade y acumulación                           */
/* ================================================================== */

describe('MembershipsService · A6 contratación y acumulación', () => {
  it('el upgrade a un nivel menor se rechaza', async () => {
    const db = makeDb({
      subscriptions: { select: { data: subscription({ tier: 'PLATINO' }) } },
    });
    await expect(
      makeService(db).upgrade(
        CLIENT,
        {
          subscription_id: SUB_ID,
          target_tier: 'START',
          target_period: 'ANUAL',
        },
        NOW,
      ),
    ).rejects.toThrow(/cancelar el contrato/i);
  });

  it('el upgrade válido crea una suscripción PENDIENTE_PAGO', async () => {
    const db = makeDb({
      subscriptions: {
        select: { data: subscription({ tier: 'GOLD' }) },
        insert: { data: subscription({ tier: 'PLATINO' }), error: null },
      },
      membership_plans: { select: { data: { id: 'plan-platino' } } },
      payments: { insert: { data: null, error: null } },
    });
    await makeService(db).upgrade(
      CLIENT,
      {
        subscription_id: SUB_ID,
        target_tier: 'PLATINO',
        target_period: 'ANUAL_ANTICIPADO',
      },
      NOW,
    );

    const inserted = db.inserts.find((i) => i.table === 'subscriptions')
      ?.payload as Record<string, unknown>;
    expect(inserted.status).toBe('PENDIENTE_PAGO');
    expect(inserted.tier).toBe('PLATINO');

    // The amount owed is the catalogue price of the prepaid annual PLATINO.
    const payment = db.inserts.find((i) => i.table === 'payments')
      ?.payload as Record<string, unknown>;
    expect(payment.amount).toBe(70_000);
  });

  it('no permite acumular sobre una membresía que no es PLATINO', async () => {
    const db = makeDb({
      subscriptions: { select: { data: [subscription({ tier: 'BLACK' })] } },
    });
    await expect(
      makeService(db).stack(
        CLIENT,
        {
          parent_subscription_id: SUB_ID,
          tier: 'GOLD',
          period: 'ANUAL',
        },
        NOW,
      ),
    ).rejects.toThrow(/PLATINO/);
  });

  it('acumula sobre PLATINO vigente enlazando parent_subscription_id', async () => {
    const parent = subscription({ tier: 'PLATINO' });
    const db = makeDb({
      subscriptions: {
        select: { data: [parent] },
        insert: { data: subscription({ tier: 'BLACK' }), error: null },
      },
      membership_plans: { select: { data: { id: 'plan-black' } } },
      payments: { insert: { data: null, error: null } },
    });
    await makeService(db).stack(
      CLIENT,
      {
        parent_subscription_id: SUB_ID,
        tier: 'BLACK',
        period: 'ANUAL',
      },
      NOW,
    );

    const inserted = db.inserts.find((i) => i.table === 'subscriptions')
      ?.payload as Record<string, unknown>;
    expect(inserted.parent_subscription_id).toBe(SUB_ID);
    expect(inserted.status).toBe('PENDIENTE_PAGO');
  });

  it('el plan anual anticipado no admite domiciliación', async () => {
    const db = makeDb({ subscriptions: { select: { data: [] } } });
    await expect(
      makeService(db).contract(
        CLIENT,
        {
          tier: 'BLUE',
          period: 'ANUAL_ANTICIPADO',
          payment_mode: 'DOMICILIADO',
        },
        NOW,
      ),
    ).rejects.toThrow(/una sola exhibición/);
  });

  it('la contratación queda siempre en PENDIENTE_PAGO', async () => {
    const db = makeDb({
      subscriptions: {
        select: { data: [] },
        insert: { data: subscription({ status: 'PENDIENTE_PAGO' }), error: null },
      },
      membership_plans: { select: { data: { id: 'plan-blue' } } },
      payments: { insert: { data: null, error: null } },
    });
    await makeService(db).contract(
      CLIENT,
      { tier: 'BLUE', period: 'TRIMESTRAL' },
      NOW,
    );

    const inserted = db.inserts.find((i) => i.table === 'subscriptions')
      ?.payload as Record<string, unknown>;
    expect(inserted.status).toBe('PENDIENTE_PAGO');

    const payment = db.inserts.find((i) => i.table === 'payments')
      ?.payload as Record<string, unknown>;
    expect(payment.amount).toBe(7_500);
    // IVA is charged on top of the published price.
    expect(payment.tax_amount).toBe(1_200);
  });
});

/* ================================================================== */
/*  A2 · Prueba                                                        */
/* ================================================================== */

describe('MembershipsService · A2 prueba de 7 días', () => {
  it('crea la suscripción en PRUEBA con trial_ends_at a 7 días', async () => {
    const db = makeDb({
      subscriptions: {
        select: { data: [] },
        insert: { data: subscription({ status: 'PRUEBA' }), error: null },
      },
      membership_plans: { select: { data: { id: 'plan-start' } } },
    });
    await makeService(db).startTrial(
      CLIENT,
      {
        tier: 'START',
        period: 'TRIMESTRAL',
        payment_method_id: 'pm_test_123',
      },
      NOW,
    );

    const inserted = db.inserts.find((i) => i.table === 'subscriptions')
      ?.payload as Record<string, unknown>;
    expect(inserted.status).toBe('PRUEBA');
    expect(inserted.trial_ends_at).toBe(
      new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
    );
    // No payment is due yet: the charge happens when the trial ends.
    expect(db.inserts.find((i) => i.table === 'payments')).toBeUndefined();
  });

  it('exige tarjeta registrada', async () => {
    const db = makeDb({ subscriptions: { select: { data: [] } } });
    await expect(
      makeService(db).startTrial(
        CLIENT,
        { tier: 'START', period: 'TRIMESTRAL', payment_method_id: '' },
        NOW,
      ),
    ).rejects.toThrow(/tarjeta registrada/);
  });

  it('la prueba es sólo para clientes nuevos', async () => {
    const db = makeDb({
      subscriptions: { select: { data: [subscription()] } },
    });
    await expect(
      makeService(db).startTrial(
        CLIENT,
        { tier: 'START', period: 'TRIMESTRAL', payment_method_id: 'pm_1' },
        NOW,
      ),
    ).rejects.toThrow(/aún no conocen BitHauss/);
  });
});
