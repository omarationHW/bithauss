import { z } from 'zod';

/**
 * Schema for submitting a KYC verification.
 */
export const submitKycSchema = z.object({
  person_type: z.enum(['FISICA', 'MORAL']),
  legal_name: z
    .string()
    .min(1, 'El nombre legal es obligatorio')
    .max(250, 'El nombre legal no puede exceder 250 caracteres'),
  rfc: z
    .string()
    .regex(
      /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/,
      'RFC inválido',
    )
    .nullable()
    .optional(),
  curp: z
    .string()
    .regex(
      /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/,
      'CURP inválida',
    )
    .nullable()
    .optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .nullable()
    .optional(),
  nationality: z.string().max(100).nullable().optional(),
  address_line: z.string().max(300).nullable().optional(),
  city: z.string().max(150).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  zip_code: z
    .string()
    .regex(/^[0-9]{5}$/, 'Código postal inválido')
    .nullable()
    .optional(),
});

export type SubmitKycInput = z.infer<typeof submitKycSchema>;
