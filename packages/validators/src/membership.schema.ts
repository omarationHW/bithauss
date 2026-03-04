import { z } from 'zod';

/**
 * Schema for creating a membership plan (admin only).
 */
export const createPlanSchema = z.object({
  tier: z.enum(['BASICO', 'PRO', 'PREMIUM']),
  name: z
    .string()
    .min(1, 'El nombre del plan es obligatorio')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  description: z.string().max(1000).nullable().optional(),
  price_monthly: z.number().positive('El precio mensual debe ser mayor a 0'),
  price_yearly: z.number().positive('El precio anual debe ser mayor a 0').nullable().optional(),
  max_properties: z.number().int().positive().nullable().optional(),
  max_users: z.number().int().positive().nullable().optional(),
  features: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

/**
 * Schema for subscribing to a plan.
 */
export const subscribeSchema = z.object({
  plan_id: z.string().uuid('ID de plan inválido'),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  payment_method: z.enum(['stripe', 'transfer', 'crypto']).default('stripe'),
  company_id: z.string().uuid('ID de empresa inválido').nullable().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
