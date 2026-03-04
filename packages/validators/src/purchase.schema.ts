import { z } from 'zod';

/**
 * Schema for creating a purchase request / offer.
 */
export const createPurchaseRequestSchema = z.object({
  property_id: z.string().uuid('ID de propiedad inválido'),
  offered_price: z.number().positive('El precio ofertado debe ser mayor a 0'),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  message: z
    .string()
    .max(2000, 'El mensaje no puede exceder 2000 caracteres')
    .optional(),
});

/**
 * Schema for creating a Letter of Intent (LOI).
 */
export const createLoiSchema = z.object({
  purchase_request_id: z.string().uuid('ID de solicitud de compra inválido'),
  agreed_price: z.number().positive('El precio acordado debe ser mayor a 0'),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  conditions: z
    .string()
    .max(5000, 'Las condiciones no pueden exceder 5000 caracteres')
    .optional(),
  expires_at: z
    .string()
    .datetime('Fecha de expiración inválida')
    .optional(),
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type CreateLoiInput = z.infer<typeof createLoiSchema>;
