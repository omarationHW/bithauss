import { z } from 'zod';

/**
 * Payment schemas.
 *
 * SECURITY: no schema here accepts an amount. Prices are computed on the
 * server from the property value and the caller's membership; a body carrying
 * `amount`/`total` is rejected by `.strict()` instead of being trusted.
 */

/** Body of `POST /payments/brc/checkout`. */
export const createBrcCheckoutSchema = z
  .object({
    expediente_id: z.string().uuid('ID de expediente inválido'),
  })
  .strict();

export const paymentTypeSchema = z.enum(['SUSCRIPCION', 'BRC_CERTIFICADO']);

export const paymentStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
  'REQUIRES_REVIEW',
]);

export const expedientePaymentStatusSchema = z.enum([
  'PENDIENTE',
  'PAGADO',
  'EXENTO',
  'REEMBOLSADO',
]);

/** Lines the customer is allowed to see. `displaySubtotal + displayIva = total`. */
export const brcClientBreakdownSchema = z.object({
  displayBase: z.number().nonnegative(),
  displayDiscount: z.number().nonnegative(),
  displaySubtotal: z.number().nonnegative(),
  displayIva: z.number().nonnegative(),
  total: z.number().positive(),
  currency: z.string(),
  tariffLabel: z.string(),
  valueRangeLabel: z.string(),
  bracketId: z.string(),
  propertyValueMxn: z.number().nonnegative(),
  membershipDiscountPct: z.number().min(0).max(1),
  ivaRate: z.number().min(0).max(1),
  hasValidPropertyValue: z.boolean(),
});

/**
 * Full breakdown, including the accounting plane. INTERNAL: `gatewayFee` is
 * for the payment record and reconciliation — never render it and never send
 * it to the browser (use `brcClientBreakdownSchema` for API responses).
 */
export const brcPriceBreakdownSchema = brcClientBreakdownSchema.extend({
  base: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  iva: z.number().nonnegative(),
  gatewayFee: z.number().nonnegative(),
});

export type CreateBrcCheckoutInput = z.infer<typeof createBrcCheckoutSchema>;
export type BrcPriceBreakdownShape = z.infer<typeof brcPriceBreakdownSchema>;
export type BrcClientBreakdownShape = z.infer<typeof brcClientBreakdownSchema>;
