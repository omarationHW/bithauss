import { z } from 'zod';

/**
 * The six BitHauss tiers and the four contract lengths (Módulo Membresías,
 * A3/A4). BASICO / PRO / PREMIUM were the MVP placeholders: they remain in
 * the Postgres enum for historical subscriptions but can no longer be sold,
 * so they are absent here on purpose.
 */
export const membershipTierSchema = z.enum([
  'START',
  'GROW',
  'BLUE',
  'GOLD',
  'BLACK',
  'PLATINO',
]);

export const membershipPeriodSchema = z.enum([
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
  'ANUAL_ANTICIPADO',
]);

/** Legacy tiers, accepted only when reading historical rows. */
export const LEGACY_MEMBERSHIP_TIERS = ['BASICO', 'PRO', 'PREMIUM'] as const;

/**
 * Schema for creating / updating a membership plan (admin only).
 * A plan is a (tier, period) pair — that pair is what must stay unique.
 */
export const createPlanSchema = z
  .object({
    tier: membershipTierSchema,
    period: membershipPeriodSchema,
    name: z
      .string()
      .min(1, 'El nombre del plan es obligatorio')
      .max(100, 'El nombre no puede exceder 100 caracteres'),
    description: z.string().max(1000).nullable().optional(),
    price_total: z.number().positive('El precio del plan debe ser mayor a 0'),
    price_monthly_instalment: z
      .number()
      .positive('La mensualidad debe ser mayor a 0')
      .nullable()
      .optional(),
    instalment_count: z.union([z.literal(3), z.literal(6), z.literal(12)]).nullable().optional(),
    duration_months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
    max_properties: z.number().int().positive(),
    max_crm_seats: z.number().int().positive(),
    brc_discount_pct: z.number().min(0).max(100).default(0),
    video_discount_pct: z.number().min(0).max(100).default(0),
    legal_tickets: z.number().int().min(0).default(0),
    has_certified_professionals_network: z.boolean().default(false),
    has_notary_network: z.boolean().default(false),
    has_legal_forms_library: z.boolean().default(false),
    features: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
  })
  .refine(
    (plan) =>
      plan.period === 'ANUAL_ANTICIPADO'
        ? plan.instalment_count == null
        : plan.instalment_count != null,
    {
      message:
        'El plan anual con pago total al contratar no admite mensualidades; los demás planes sí.',
      path: ['instalment_count'],
    },
  )
  .refine(
    (plan) => plan.legal_tickets === 0 || plan.period === 'ANUAL_ANTICIPADO',
    {
      message:
        'Los tickets de consultas jurídicas aplican únicamente pagando por anticipado el Plan Anual.',
      path: ['legal_tickets'],
    },
  );

/**
 * Contracting a membership (A1). `payment_mode` decides whether the client is
 * charged the whole contract now or by monthly direct debit (A4).
 */
export const subscribeSchema = z
  .object({
    tier: membershipTierSchema,
    period: membershipPeriodSchema,
    payment_mode: z.enum(['UNICO', 'DOMICILIADO']).default('UNICO'),
    payment_method: z
      .enum(['stripe', 'transfer', 'crypto', 'domiciliacion'])
      .default('stripe'),
    company_id: z.string().uuid('ID de empresa inválido').nullable().optional(),
    /** Card on file is mandatory when starting from the free trial (A2). */
    start_trial: z.boolean().default(false),
    has_card_on_file: z.boolean().default(false),
  })
  .refine(
    (input) =>
      input.period !== 'ANUAL_ANTICIPADO' || input.payment_mode === 'UNICO',
    {
      message:
        'El Plan Anual con precio especial se paga en una sola exhibición.',
      path: ['payment_mode'],
    },
  )
  .refine((input) => !input.start_trial || input.has_card_on_file, {
    message:
      'Para iniciar los 7 días de prueba se requiere una tarjeta registrada.',
    path: ['has_card_on_file'],
  });

/**
 * A2 — start the 7-day free trial. Card on file is a hard requirement: the
 * plan is charged automatically when the trial ends unless the client cancels.
 */
export const startTrialSchema = z.object({
  tier: membershipTierSchema,
  period: membershipPeriodSchema,
  payment_method_id: z
    .string()
    .min(1, 'Se requiere una tarjeta registrada para iniciar la prueba'),
  company_id: z.string().uuid('ID de empresa inválido').nullable().optional(),
});

/**
 * A6 — upgrade. Only moving to a higher tier is allowed; a downgrade forces
 * the client to cancel the contract and open a new one, so it is rejected
 * here rather than silently converted.
 */
export const upgradeSubscriptionSchema = z.object({
  subscription_id: z.string().uuid('ID de suscripción inválido'),
  target_tier: membershipTierSchema,
  target_period: membershipPeriodSchema,
});

/**
 * A6 — stacking an extra membership onto an existing PLATINO subscription.
 * The parent must be PLATINO; the service enforces it, this only shapes input.
 */
export const stackMembershipSchema = z.object({
  parent_subscription_id: z.string().uuid('ID de suscripción inválido'),
  tier: membershipTierSchema,
  period: membershipPeriodSchema,
  payment_method: z
    .enum(['stripe', 'transfer', 'crypto', 'domiciliacion'])
    .default('stripe'),
});

/**
 * A5 — second-actor confirmation of a payment before access is granted.
 * `confirm` must be sent explicitly so an accidental request cannot activate
 * an account.
 */
export const confirmPaymentSchema = z.object({
  subscription_id: z.string().uuid('ID de suscripción inválido'),
  payment_id: z.string().uuid('ID de pago inválido').nullable().optional(),
  confirm: z.literal(true, {
    errorMap: () => ({
      message: 'La confirmación de pago debe ser explícita.',
    }),
  }),
  notes: z.string().max(500).nullable().optional(),
});

/** A5 — step 1: an operator flags the account for cancellation. */
export const requestCancellationSchema = z.object({
  subscription_id: z.string().uuid('ID de suscripción inválido'),
  reason: z
    .string()
    .min(5, 'Indica el motivo de la cancelación')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
});

/** A5 — step 2: a different admin authorises the cancellation. */
export const confirmCancellationSchema = z.object({
  subscription_id: z.string().uuid('ID de suscripción inválido'),
  confirm: z.literal(true, {
    errorMap: () => ({
      message: 'La cancelación debe confirmarse explícitamente.',
    }),
  }),
});

/** Consuming one legal-consultation ticket. */
export const consumeLegalTicketSchema = z.object({
  subscription_id: z.string().uuid('ID de suscripción inválido'),
  subject: z
    .string()
    .min(10, 'Describe tu consulta jurídica (mínimo 10 caracteres)')
    .max(2000),
});

export type MembershipTierInput = z.infer<typeof membershipTierSchema>;
export type MembershipPeriodInput = z.infer<typeof membershipPeriodSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type StartTrialInput = z.infer<typeof startTrialSchema>;
export type UpgradeSubscriptionInput = z.infer<typeof upgradeSubscriptionSchema>;
export type StackMembershipInput = z.infer<typeof stackMembershipSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type RequestCancellationInput = z.infer<typeof requestCancellationSchema>;
export type ConfirmCancellationInput = z.infer<typeof confirmCancellationSchema>;
export type ConsumeLegalTicketInput = z.infer<typeof consumeLegalTicketSchema>;
