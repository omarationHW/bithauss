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
