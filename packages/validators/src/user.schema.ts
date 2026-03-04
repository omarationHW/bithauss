import { z } from 'zod';

/**
 * Schema for creating a user profile (initial onboarding).
 */
export const createProfileSchema = z.object({
  first_name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  last_name: z
    .string()
    .min(1, 'El apellido es obligatorio')
    .max(100, 'El apellido no puede exceder 100 caracteres'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Número de teléfono inválido')
    .nullable()
    .optional(),
  avatar_url: z.string().url('URL de avatar inválida').nullable().optional(),
  role: z.enum([
    'ADMIN',
    'INMOBILIARIA',
    'BROKER',
    'VENDEDOR',
    'COMPRADOR',
    'NOTARIO',
    'OPERADOR_BRC',
  ]),
});

/**
 * Schema for updating an existing profile (all fields optional).
 */
export const updateProfileSchema = createProfileSchema.partial();

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
