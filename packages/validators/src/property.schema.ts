import { z } from 'zod';

import {
  PROPERTY_TYPES,
  PROPERTY_FIELD_META,
  getFieldRequirement,
  validatePropertyFields,
  type PropertyFieldKey,
} from './property-fields';

import {
  MAX_PROPERTY_VIDEOS,
  MAX_VIDEO_FILE_BYTES,
  parseVideoUrl,
} from './property-video';

/**
 * The per-type field matrix (which fields each `property_type` shows and
 * which are mandatory) lives in ./property-fields so the web forms, this
 * schema and the API all read one table.
 *
 * It is re-exported from here because this module is already in the package
 * barrel — consumers just `import { PROPERTY_FIELD_MATRIX } from
 * '@bithauss/validators'`.
 */
export * from './property-fields';

/**
 * Video/media rules (URL allowlist, size limit, per-property maximum) live in
 * ./property-video for the same reason, and are re-exported here so the web
 * forms and the API import them from '@bithauss/validators' too.
 */
export * from './property-video';

/**
 * Operations a NEW listing may be published with.
 *
 * TRASPASO was retired as an operation at the client's request ("en la parte
 * para dar de alta una propiedad sugiero eliminar la opción de Traspaso"): a
 * traspaso is an attribute of a commercial unit, captured by the matrix row
 * "¿Aplica traspaso?" (`applies_traspaso`, LOCAL_COMERCIAL only), not a way of
 * transacting the property.
 */
export const PROPERTY_OPERATIONS = ['VENTA', 'RENTA', 'VENTA_RENTA'] as const;

/**
 * Operations that exist in the Postgres enum but can no longer be selected.
 *
 * Postgres cannot drop an enum value, and rows published before the change
 * still carry TRASPASO. Read-only surfaces (public listing, ficha técnica,
 * historial) must keep labelling them, so they widen their accepted operation
 * set with this list instead of silently rendering a raw enum value.
 */
export const LEGACY_PROPERTY_OPERATIONS = ['TRASPASO'] as const;

/** Every operation that may be READ from the database (current + legacy). */
export const ALL_PROPERTY_OPERATIONS = [
  ...PROPERTY_OPERATIONS,
  ...LEGACY_PROPERTY_OPERATIONS,
] as const;

export type PropertyOperationValue = (typeof PROPERTY_OPERATIONS)[number];
export type LegacyPropertyOperationValue = (typeof LEGACY_PROPERTY_OPERATIONS)[number];
export type AnyPropertyOperationValue = (typeof ALL_PROPERTY_OPERATIONS)[number];

/** True when `operation` is a retired value only kept for historical rows. */
export function isLegacyPropertyOperation(
  operation: string | null | undefined,
): operation is LegacyPropertyOperationValue {
  return (LEGACY_PROPERTY_OPERATIONS as readonly string[]).includes(
    (operation ?? '').toUpperCase(),
  );
}

/**
 * Shape of a property listing payload.
 *
 * Kept as a plain object schema so `.partial()` still works for updates; the
 * per-type matrix rules are layered on top with `superRefine` (a ZodEffects
 * has no `.partial()`).
 */
const propertyObjectSchema = z.object({
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
  type: z.enum(PROPERTY_TYPES),
  operation: z.enum(PROPERTY_OPERATIONS),

  // Pricing — `price` keeps the legacy single value (fallback). For
  // VENTA_RENTA you should set price_sale and price_rent.
  price: z.number().positive('El precio debe ser mayor a 0').nullable().optional(),
  price_sale: z.number().positive('El precio de venta debe ser mayor a 0').nullable().optional(),
  price_rent: z.number().positive('El precio de renta debe ser mayor a 0').nullable().optional(),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  accepts_crypto: z.boolean().default(false),
  show_price: z.boolean().default(true),

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
  half_bathrooms: z
    .number()
    .int()
    .min(0)
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
  floor_number: z.number().int().min(0).nullable().optional(),
  maintenance_fee: z.number().min(0).nullable().optional(),
  /** Matrix row "Antigüedad" (years since construction). */
  age_years: z
    .number()
    .int('La antigüedad debe ser un número entero')
    .min(0, 'La antigüedad no puede ser negativa')
    .max(500, 'La antigüedad no puede exceder 500 años')
    .nullable()
    .optional(),
  /**
   * Matrix row "No. Privados / Espacios".
   *
   * Its own column on purpose: EDIFICIO used to store its unit count in
   * `bedrooms`, which made "recámaras" mean two different things and broke
   * any query that filtered by bedrooms. `bedrooms` now only ever means
   * recámaras/habitaciones (casa, depto, hotel); commercial types
   * (oficina, local, bodega, nave, edificio) count privados here.
   */
  private_units: z
    .number()
    .int('Los privados deben ser un número entero')
    .min(0, 'Los privados no pueden ser negativos')
    .max(10000)
    .nullable()
    .optional(),

  // Private features (unit-level, NOT building amenities)
  has_service_room: z.boolean().default(false),
  has_storage: z.boolean().default(false),
  /**
   * Matrix row "Terraza" — a *tri-state*: null means the publisher never
   * answered. It cannot default to false, because that would answer "No" on
   * their behalf, which is precisely what "forzar a responder" forbids.
   */
  has_terrace: z.boolean().nullable().optional(),
  has_laundry_room: z.boolean().default(false),
  has_integrated_kitchen: z.boolean().default(false),

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
  show_address: z.boolean().default(true),

  /**
   * Matrix row "Amueblado" — tri-state, see `has_terrace`.
   */
  is_furnished: z.boolean().nullable().optional(),

  /**
   * Matrix row "¿Aplica traspaso?" — LOCAL_COMERCIAL only.
   *
   * This is what replaced the retired TRASPASO operation: the traspaso is a
   * property of the unit (the tenant sells the remaining lease and fit-out),
   * not a way of transacting it.
   */
  applies_traspaso: z.boolean().nullable().optional(),

  // Extras — `amenities` now refers to the building's common areas only
  amenities: z.array(z.string()).default([]),
  /**
   * Matrix row "Amenidades" is "forzar a responder": the publisher must
   * CONFIRM the selection, and "sin amenidades" is a valid answer. An empty
   * `amenities` array therefore cannot be used as the "unanswered" marker —
   * this flag is.
   */
  amenities_answered: z.boolean().default(false),
  featured_image_url: z.string().url('URL de imagen inválida').nullable().optional(),
});

/* ------------------------------------------------------------------ */
/*  Conditional rules per property type                                */
/* ------------------------------------------------------------------ */

/**
 * Reads the matrix from ./property-fields rather than restating the rules —
 * duplicating them here is how the forms and the API ended up disagreeing
 * about which fields a Bodega or a Nave Industrial must carry.
 *
 * `price` is deliberately resolved from `price_sale` / `price_rent` before it
 * reaches the matrix: the operation (VENTA / RENTA / VENTA_RENTA) decides
 * which bucket holds the amount, and the matrix only knows "there must be a
 * price".
 */
function refinePropertyFields(
  data: Partial<z.infer<typeof propertyObjectSchema>>,
  ctx: z.RefinementCtx,
): void {
  if (!data.type) return; // nothing to key the matrix on

  const errors = validatePropertyFields(data.type, {
    price: data.price ?? data.price_sale ?? data.price_rent ?? null,
    currency: data.currency ?? null,
    area_built: data.area_built ?? null,
    area_total: data.area_total ?? null,
    bedrooms: data.bedrooms ?? null,
    private_units: data.private_units ?? null,
    bathrooms: data.bathrooms ?? null,
    half_bathrooms: data.half_bathrooms ?? null,
    parking_spaces: data.parking_spaces ?? null,
    age_years: data.age_years ?? null,
    floor_number: data.floor_number ?? null,
    floors: data.floors ?? null,
    maintenance_fee: data.maintenance_fee ?? null,
    is_furnished: data.is_furnished ?? null,
    has_terrace: data.has_terrace ?? null,
    amenities: data.amenities ?? null,
    amenities_answered: data.amenities_answered ?? null,
    applies_traspaso: data.applies_traspaso ?? null,
  });

  for (const error of errors) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      // `amenities` reports on the confirmation flag, everything else on its
      // own key, so react-hook-form can focus the offending control.
      path: [fieldIssuePath(error.field)],
      message: error.message,
    });
  }

  // A field the matrix hides for this type must not be persisted: a value
  // left over from a previously selected type is stale, not merely unused.
  for (const field of Object.keys(PROPERTY_FIELD_META) as PropertyFieldKey[]) {
    if (field === 'price' || field === 'currency' || field === 'amenities') continue;
    if (getFieldRequirement(field, data.type) !== 'HIDDEN') continue;
    const value = (data as Record<string, unknown>)[field];
    if (value !== undefined && value !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${PROPERTY_FIELD_META[field].label} no aplica para este tipo de inmueble.`,
      });
    }
  }
}

function fieldIssuePath(field: PropertyFieldKey): string {
  return field === 'amenities' ? 'amenities_answered' : field;
}

/**
 * Schema for creating a property listing.
 */
export const createPropertySchema = propertyObjectSchema.superRefine(refinePropertyFields);

/**
 * Schema for updating a property (all fields optional).
 *
 * The matrix rules only run when the payload carries a `type` — a partial
 * update that does not touch the type cannot be judged against it.
 */
export const updatePropertySchema = propertyObjectSchema
  .partial()
  .superRefine(refinePropertyFields);

/**
 * Schema for property search / listing query parameters.
 */
export const propertySearchSchema = z.object({
  q: z.string().optional(),
  type: z
    .enum(PROPERTY_TYPES)
    .optional(),
  // Search may still filter historical rows, so the legacy value is accepted
  // here even though it can no longer be published.
  operation: z.enum(ALL_PROPERTY_OPERATIONS).optional(),
  status: z
    .enum(['BORRADOR', 'PUBLICADO', 'PAUSADO', 'VENDIDO', 'ARCHIVADO', 'ELIMINADO'])
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

/* ------------------------------------------------------------------ */
/*  Media (fotos y video)                                              */
/* ------------------------------------------------------------------ */

export const PROPERTY_MEDIA_TYPES = ['IMAGE', 'VIDEO', 'TOUR_360'] as const;
export const PROPERTY_MEDIA_PROVIDERS = ['UPLOAD', 'YOUTUBE', 'VIMEO'] as const;

/**
 * A video the publisher wants attached to the listing.
 *
 * Two shapes, discriminated by `provider`:
 *
 *   UPLOAD  — `url` must point at an object we host. It is produced by our own
 *             upload flow, so it is validated as a plain https URL.
 *   YOUTUBE / VIMEO — `url` is re-parsed through the host allowlist and
 *             REBUILT from the extracted id. Accepting the raw string would
 *             let `javascript:`, `data:` or a look-alike host such as
 *             `youtube.com.evil.tld` reach an <iframe src> on the public page.
 *
 * `.transform` (not just `.refine`) on purpose: the value that leaves this
 * schema is the canonical URL, so a caller cannot accidentally persist the
 * original input.
 */
export const propertyVideoInputSchema = z
  .object({
    provider: z.enum(PROPERTY_MEDIA_PROVIDERS),
    url: z.string().min(1).max(2048),
    external_id: z.string().max(64).nullish(),
    thumbnail_url: z.string().url().max(2048).nullish(),
    duration_seconds: z.number().int().min(0).max(24 * 60 * 60).nullish(),
    alt_text: z.string().max(300).nullish(),
    sort_order: z.number().int().min(0).max(MAX_PROPERTY_VIDEOS - 1).optional(),
    is_primary: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.provider === 'UPLOAD') {
      if (!/^https:\/\/[^\s]+$/i.test(value.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'La URL del video subido debe ser https.',
        });
      }
      return;
    }

    const parsed = parseVideoUrl(value.url);
    if (!parsed || parsed.provider !== value.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message:
          'La liga del video debe ser de YouTube o Vimeo (por ejemplo https://youtu.be/xxxxxxxxxxx).',
      });
    }
  })
  .transform((value) => {
    if (value.provider === 'UPLOAD') return value;
    const parsed = parseVideoUrl(value.url)!;
    // Persist ONLY what we rebuilt ourselves.
    return {
      ...value,
      url: parsed.canonicalUrl,
      external_id: parsed.externalId,
      thumbnail_url: value.thumbnail_url ?? parsed.thumbnailUrl,
    };
  });

export type PropertyVideoInput = z.infer<typeof propertyVideoInputSchema>;

/** The full ordered set of videos of one property. */
export const propertyVideoListSchema = z
  .array(propertyVideoInputSchema)
  .max(MAX_PROPERTY_VIDEOS, {
    message: `Solo puedes agregar ${MAX_PROPERTY_VIDEOS} videos por propiedad.`,
  });

/** Metadata of a video FILE, checked before it is accepted for upload. */
export const propertyVideoFileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_VIDEO_FILE_BYTES, {
    message: `El video excede el máximo de ${Math.round(
      MAX_VIDEO_FILE_BYTES / (1024 * 1024),
    )} MB.`,
  }),
  /**
   * Advisory only. The authoritative check is the magic-byte sniff
   * (`sniffVideoMime`) — `File.type` is set by the client.
   */
  type: z.string().max(120).optional(),
});

/** Reordering payload: the media ids in their new order. */
export const propertyMediaReorderSchema = z.object({
  media_ids: z.array(z.string().uuid()).min(1).max(64),
});

/** The raw object shape, without the per-type matrix rules. */
export const propertyBaseSchema = propertyObjectSchema;

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertySearchInput = z.infer<typeof propertySearchSchema>;
