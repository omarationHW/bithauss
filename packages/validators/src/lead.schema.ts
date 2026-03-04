import { z } from 'zod';

/**
 * Schema for creating a lead / inquiry on a property.
 */
export const createLeadSchema = z.object({
  property_id: z.string().uuid('ID de propiedad inválido'),
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  email: z.string().email('Correo electrónico inválido'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Número de teléfono inválido')
    .optional(),
  message: z
    .string()
    .max(2000, 'El mensaje no puede exceder 2000 caracteres')
    .optional(),
  source: z.enum(['ORGANICO', 'CAMPANA', 'REFERIDO', 'DIRECTO']).default('ORGANICO'),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
