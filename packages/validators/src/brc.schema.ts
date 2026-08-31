import { z } from 'zod';

/**
 * Schema for requesting a BRC certification for a property.
 */
export const requestBrcSchema = z.object({
  property_id: z.string().uuid('ID de propiedad inválido'),
  notes: z
    .string()
    .max(2000, 'Las notas no pueden exceder 2000 caracteres')
    .optional(),
});

/**
 * Schema for uploading a document to a BRC expediente.
 */
export const uploadBrcDocumentSchema = z.object({
  expediente_id: z.string().uuid('ID de expediente inválido'),
  document_type_id: z.string().uuid('ID de tipo de documento inválido'),
  file_url: z.string().url('URL de archivo inválida'),
  file_name: z
    .string()
    .min(1, 'El nombre del archivo es obligatorio')
    .max(255, 'El nombre del archivo no puede exceder 255 caracteres'),
  file_size: z
    .number()
    .int()
    .positive('El tamaño del archivo debe ser mayor a 0')
    .max(50 * 1024 * 1024, 'El archivo no puede exceder 50 MB'),
  mime_type: z
    .string()
    .regex(
      /^(application\/pdf|image\/(jpeg|png|webp))$/,
      'Tipo de archivo no soportado. Solo PDF, JPEG, PNG o WebP.',
    ),
});

export type RequestBrcInput = z.infer<typeof requestBrcSchema>;
export type UploadBrcDocumentInput = z.infer<typeof uploadBrcDocumentSchema>;

/**
 * Step A — the NOTARY uploads the Certificado Notarial.
 *
 * Note what is NOT here: a certificate number. This document is not the BRC;
 * BitHauss issues that from it (see `issueBrcSchema`) and derives the folio
 * server-side.
 */
export const issueNotarialCertificateSchema = z.object({
  file_url: z.string().url('URL de archivo inválida'),
  file_name: z
    .string()
    .min(1, 'El nombre del archivo es obligatorio')
    .max(255, 'El nombre del archivo no puede exceder 255 caracteres'),
  file_size: z
    .number()
    .int()
    .positive('El tamaño del archivo debe ser mayor a 0')
    .max(50 * 1024 * 1024, 'El archivo no puede exceder 50 MB')
    .optional(),
  mime_type: z
    .string()
    .regex(
      /^(application\/pdf|image\/(jpeg|png|webp))$/,
      'Tipo de archivo no soportado. Solo PDF, JPEG, PNG o WebP.',
    )
    .optional(),
  observations: z
    .string()
    .max(5000, 'Las observaciones no pueden exceder 5000 caracteres')
    .optional(),
});

/**
 * Step B — BitHauss issues the BRC from the Certificado Notarial.
 * The folio is deliberately absent: it is assigned by the server.
 */
export const issueBrcSchema = z.object({
  pdf_url: z.string().url('URL de archivo inválida').optional(),
  qr_code_url: z.string().url('URL de QR inválida').optional(),
  observations: z
    .string()
    .max(5000, 'Las observaciones no pueden exceder 5000 caracteres')
    .optional(),
});

/** Outcomes a certificate collected by the notary can have. */
export const brcCollectedCertificateResults = [
  'FAVORABLE',
  'DESFAVORABLE',
  'SIN_RESULTADO',
] as const;

/**
 * The "certificados recabados por notaría" block (RPP / Predial / Agua /
 * otros). Every field is optional so a partial save never wipes a sibling
 * field the notary filled in earlier.
 */
export const brcCertificateTrackingSchema = z.object({
  cert_requested_at: z.string().datetime().nullable().optional(),
  cert_received_at: z.string().datetime().nullable().optional(),
  cert_result: z.enum(brcCollectedCertificateResults).nullable().optional(),
  cert_requirement: z
    .string()
    .max(2000, 'El requerimiento no puede exceder 2000 caracteres')
    .nullable()
    .optional(),
  notary_legal_opinion: z
    .string()
    .max(5000, 'El dictamen no puede exceder 5000 caracteres')
    .nullable()
    .optional(),
});

export type IssueNotarialCertificateInput = z.infer<
  typeof issueNotarialCertificateSchema
>;
export type IssueBrcInput = z.infer<typeof issueBrcSchema>;
export type BrcCertificateTrackingInput = z.infer<
  typeof brcCertificateTrackingSchema
>;
