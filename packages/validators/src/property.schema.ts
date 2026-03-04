import { z } from 'zod';

/**
 * Schema for creating a property listing.
 */
export const createPropertySchema = z.object({
  // Core info
  title: z
    .string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres'),
  description: z
    .string()
    .max(5000, 'La descripción no puede exceder 5000 caracteres')
    .nullable()
    .optional(),
  type: z.enum([
    'CASA',
    'DEPARTAMENTO',
    'TERRENO',
    'OFICINA',
    'LOCAL_COMERCIAL',
    'BODEGA',
    'OTRO',
  ]),
  operation: z.enum(['VENTA', 'RENTA', 'TRASPASO']),

  // Pricing
  price: z.number().positive('El precio debe ser mayor a 0'),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  accepts_crypto: z.boolean().default(false),

  // Dimensions & features
  area_total: z.number().positive('El área total debe ser mayor a 0').nullable().optional(),
  area_built: z.number().positive('El área construida debe ser mayor a 0').nullable().optional(),
  bedrooms: z
    .number()
    .int('Las recámaras deben ser un número entero')
    .min(0, 'Las recámaras no pueden ser negativas')
    .nullable()
    .optional(),
  bathrooms: z
    .number()
    .int('Los baños deben ser un número entero')
    .min(0, 'Los baños no pueden ser negativos')
    .nullable()
    .optional(),
  parking_spaces: z
    .number()
    .int('Los estacionamientos deben ser un número entero')
    .min(0, 'Los estacionamientos no pueden ser negativos')
    .nullable()
    .optional(),
  floors: z
    .number()
    .int('Los pisos deben ser un número entero')
    .min(0, 'Los pisos no pueden ser negativos')
    .nullable()
    .optional(),

  // Location
  address_line: z.string().max(300).nullable().optional(),
  neighborhood: z.string().max(150).nullable().optional(),
  city: z
    .string()
    .min(1, 'La ciudad es obligatoria')
    .max(150, 'La ciudad no puede exceder 150 caracteres'),
  state: z
    .string()
    .min(1, 'El estado es obligatorio')
    .max(100, 'El estado no puede exceder 100 caracteres'),
  zip_code: z
    .string()
    .regex(/^[0-9]{5}$/, 'Código postal inválido (5 dígitos)')
    .nullable()
    .optional(),
  country: z.string().default('MX'),
  latitude: z
    .number()
    .min(-90, 'Latitud inválida')
    .max(90, 'Latitud inválida')
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitud inválida')
    .max(180, 'Longitud inválida')
    .nullable()
    .optional(),

  // Extras
  amenities: z.array(z.string()).default([]),
  featured_image_url: z.string().url('URL de imagen inválida').nullable().optional(),
});

/**
 * Schema for updating a property (all fields optional).
 */
export const updatePropertySchema = createPropertySchema.partial();

/**
 * Schema for property search / listing query parameters.
 */
export const propertySearchSchema = z.object({
  q: z.string().optional(),
  type: z
    .enum([
      'CASA',
      'DEPARTAMENTO',
      'TERRENO',
      'OFICINA',
      'LOCAL_COMERCIAL',
      'BODEGA',
      'OTRO',
    ])
    .optional(),
  operation: z.enum(['VENTA', 'RENTA', 'TRASPASO']).optional(),
  status: z
    .enum(['BORRADOR', 'PUBLICADO', 'PAUSADO', 'VENDIDO', 'ELIMINADO'])
    .optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  price_min: z.coerce.number().positive().optional(),
  price_max: z.coerce.number().positive().optional(),
  currency: z.enum(['MXN', 'USD']).optional(),
  bedrooms_min: z.coerce.number().int().min(0).optional(),
  bathrooms_min: z.coerce.number().int().min(0).optional(),
  area_min: z.coerce.number().positive().optional(),
  area_max: z.coerce.number().positive().optional(),
  brc_certified: z.coerce.boolean().optional(),
  sort_by: z
    .enum(['price', 'created_at', 'area_total', 'view_count'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertySearchInput = z.infer<typeof propertySearchSchema>;
