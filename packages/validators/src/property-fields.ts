/* ------------------------------------------------------------------ */
/*  DATOS DEL INMUEBLE × TIPO DE PROPIEDAD                             */
/*                                                                     */
/*  Single source of truth for which listing fields each property type */
/*  shows, and which of those the publisher MUST answer.               */
/*                                                                     */
/*  Transcribed cell by cell from the client's matrix image            */
/*  ("DATOS DEL INMUEBLE / TIPO DE PROPIEDAD", 17 rows × 11 type       */
/*  columns). Semantics of the image:                                  */
/*    · empty cell            → field is NOT shown for that type       */
/*    · check on white        → field is shown and OPTIONAL            */
/*    · check on GREEN        → field is shown and REQUIRED            */
/*                                                                     */
/*  It lives in @bithauss/validators (not in apps/web) so the Zod      */
/*  schema, the API and the web forms all read the SAME table — the    */
/*  per-type rules used to be re-implemented in each form and drifted. */
/* ------------------------------------------------------------------ */

/**
 * Every value of the `property_type` enum that the product offers.
 *
 * Single source of truth on purpose: this list used to be written out twice in
 * property.schema.ts, and each new type (Casa en Condominio, Hotel, Edificio…)
 * had to be added in both places — which is exactly how types ended up
 * accepted by one schema and rejected by the other.
 *
 * DEPARTAMENTO_HOTEL still exists in the database enum (Postgres cannot drop
 * enum values) but was retired from the catalogue and is deliberately absent.
 *
 * The order matches the columns of the client's matrix, plus OTRO (which the
 * matrix does not cover — see MATRIX_COLUMNS below).
 */
export const PROPERTY_TYPES = [
  'CASA',
  'CASA_CONDOMINIO',
  'CASA_USO_SUELO',
  'DEPARTAMENTO',
  'TERRENO',
  'OFICINA',
  'LOCAL_COMERCIAL',
  'BODEGA',
  'NAVE_INDUSTRIAL',
  'HOTEL',
  'EDIFICIO',
  'OTRO',
] as const;

export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number];

/**
 * The 17 rows of the matrix, in the image's order.
 *
 * Keys are the `properties` column each row persists to, so a form value map
 * can be turned into an insert/update payload without a translation table.
 */
export const PROPERTY_FIELD_KEYS = [
  'price',
  'currency',
  'area_built',
  'area_total',
  'bedrooms',
  'private_units',
  'bathrooms',
  'half_bathrooms',
  'parking_spaces',
  'age_years',
  'floor_number',
  'floors',
  'maintenance_fee',
  'is_furnished',
  'has_terrace',
  'amenities',
  'applies_traspaso',
] as const;

export type PropertyFieldKey = (typeof PROPERTY_FIELD_KEYS)[number];

/** HIDDEN = empty cell · OPTIONAL = white check · REQUIRED = green check. */
export type PropertyFieldRequirement = 'HIDDEN' | 'OPTIONAL' | 'REQUIRED';

/**
 * How a row is captured.
 *
 * `tristate` is the image's "Checkbox, forzar a responder": the publisher has
 * to pick Sí or No explicitly, so the value is `boolean | null` and `null`
 * (unanswered) is invalid. A plain checkbox that starts at `false` would
 * answer "No" on the user's behalf, which is exactly what the client asked us
 * to stop doing.
 *
 * `amenities` is the same idea applied to a multi-select: "answering" means
 * confirming the selection, and an empty selection is a legitimate answer.
 */
export type PropertyFieldKind =
  | 'currency' // amount in the listing currency
  | 'currency-code' // MXN / USD selector
  | 'number' // integer or decimal count / measure
  | 'tristate' // Sí / No, must be answered
  | 'amenities'; // multi-select whose selection must be confirmed

export interface PropertyFieldMeta {
  /** Label shown in the form (Spanish, as in the client's matrix). */
  label: string;
  /**
   * Per-type label override. The same column means different things depending
   * on the asset: `bedrooms` is "recámaras" for a house and "habitaciones" for
   * a hotel; `private_units` is "privados" for an office and "unidades" for a
   * building.
   */
  labelByType?: Partial<Record<PropertyTypeValue, string>>;
  kind: PropertyFieldKind;
  /** Suffix rendered next to the input (m², años, …). */
  unit?: string;
  /** Whether 0 is a legitimate value. Prices and areas must be > 0. */
  allowsZero: boolean;
  /** Whether the value must be a whole number (counts, levels, years). */
  integer: boolean;
  /** Upper sanity bound, mirrored by the DB check constraints. */
  max?: number;
  /** Error shown when a REQUIRED field is missing (gendered Spanish). */
  requiredMessage: string;
}

export const PROPERTY_FIELD_META: Record<PropertyFieldKey, PropertyFieldMeta> = {
  price: {
    label: 'Precio',
    kind: 'currency',
    allowsZero: false,
    integer: false,
    requiredMessage: 'Ingresa el precio.',
  },
  currency: {
    label: 'Moneda',
    kind: 'currency-code',
    allowsZero: true,
    integer: false,
    requiredMessage: 'Selecciona la moneda.',
  },
  area_built: {
    label: 'M² de construcción',
    kind: 'number',
    // No `unit`: the label already carries "M²", and rendering it twice
    // ("M² de construcción (m²)") reads as a mistake.
    allowsZero: false,
    integer: false,
    max: 10_000_000,
    requiredMessage: 'Ingresa los m² de construcción.',
  },
  area_total: {
    label: 'M² totales del terreno',
    kind: 'number',
    allowsZero: false,
    integer: false,
    max: 10_000_000,
    requiredMessage: 'Ingresa los m² totales del terreno.',
  },
  bedrooms: {
    label: 'No. de recámaras',
    labelByType: { HOTEL: 'No. de habitaciones' },
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 1000,
    requiredMessage: 'Indica el número de recámaras.',
  },
  private_units: {
    label: 'No. de privados / espacios',
    labelByType: { EDIFICIO: 'No. de departamentos / unidades' },
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 10_000,
    requiredMessage: 'Indica el número de privados o espacios.',
  },
  bathrooms: {
    label: 'No. de baños',
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 1000,
    requiredMessage: 'Indica el número de baños.',
  },
  half_bathrooms: {
    label: 'No. de medios baños',
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 1000,
    requiredMessage: 'Indica el número de medios baños.',
  },
  parking_spaces: {
    label: 'No. de espacios de estacionamiento',
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 10_000,
    requiredMessage: 'Indica el número de espacios de estacionamiento.',
  },
  age_years: {
    label: 'Antigüedad',
    kind: 'number',
    unit: 'años',
    allowsZero: true,
    integer: true,
    max: 500,
    requiredMessage: 'Indica la antigüedad en años.',
  },
  floor_number: {
    label: 'Nivel en el que se encuentra',
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 500,
    requiredMessage: 'Indica el nivel en el que se encuentra.',
  },
  floors: {
    label: 'Niveles construidos',
    kind: 'number',
    allowsZero: true,
    integer: true,
    max: 200,
    requiredMessage: 'Indica los niveles construidos.',
  },
  maintenance_fee: {
    label: 'Cuota de mantenimiento',
    kind: 'currency',
    allowsZero: true,
    integer: false,
    requiredMessage: 'Ingresa la cuota de mantenimiento.',
  },
  is_furnished: {
    label: 'Amueblado',
    kind: 'tristate',
    allowsZero: true,
    integer: false,
    requiredMessage: 'Indica si el inmueble está amueblado.',
  },
  has_terrace: {
    label: 'Terraza',
    kind: 'tristate',
    allowsZero: true,
    integer: false,
    requiredMessage: 'Indica si el inmueble tiene terraza.',
  },
  amenities: {
    label: 'Amenidades',
    kind: 'amenities',
    allowsZero: true,
    integer: false,
    requiredMessage:
      'Confirma las amenidades del inmueble (puedes confirmar que no tiene ninguna).',
  },
  applies_traspaso: {
    label: '¿Aplica traspaso?',
    kind: 'tristate',
    allowsZero: true,
    integer: false,
    requiredMessage: 'Indica si aplica traspaso.',
  },
};

/* ------------------------------------------------------------------ */
/*  The matrix                                                         */
/* ------------------------------------------------------------------ */

/**
 * Column order of the encoded rows below. The first eleven are the columns of
 * the client's image, left to right. OTRO is NOT in the image: it is the
 * catch-all type the catalogue has always offered, so it gets a documented
 * fallback column (everything visible and optional, except price/currency
 * which are required for all eleven real types, and "¿Aplica traspaso?" which
 * the client scoped to Local Comercial only).
 */
const MATRIX_COLUMNS = [
  'CASA',
  'CASA_CONDOMINIO',
  'CASA_USO_SUELO',
  'DEPARTAMENTO',
  'TERRENO',
  'OFICINA',
  'LOCAL_COMERCIAL',
  'BODEGA',
  'NAVE_INDUSTRIAL',
  'HOTEL',
  'EDIFICIO',
  'OTRO',
] as const satisfies readonly PropertyTypeValue[];

/**
 * One string per row, one character per column of MATRIX_COLUMNS:
 *   R = green cell   (shown, required)
 *   O = white check  (shown, optional)
 *   . = empty cell   (not shown)
 *
 * Encoded rather than written out as 204 object literals so the table can be
 * read against the image at a glance — the alignment IS the review surface.
 */
const MATRIX_ROWS: Record<PropertyFieldKey, string> = {
  //                 CASA  CC  CUS DEPT TERR OFIC LOCL BODE NAVE HOTL EDIF OTRO
  price: '            R    R    R    R    R    R    R    R    R    R    R    R',
  currency: '         R    R    R    R    R    R    R    R    R    R    R    R',
  area_built: '       R    R    R    R    .    R    R    R    R    R    R    O',
  area_total: '       R    R    R    .    R    O    O    R    R    R    R    O',
  bedrooms: '         R    R    .    R    .    .    .    .    .    R    .    O',
  private_units: '    .    .    .    .    .    R    R    R    O    .    R    O',
  bathrooms: '        O    O    O    O    .    O    O    O    O    O    O    O',
  half_bathrooms: '   O    O    O    O    .    O    O    O    O    O    O    O',
  parking_spaces: '   O    O    O    O    .    O    O    O    O    O    O    O',
  age_years: '        O    O    O    O    O    O    O    O    O    O    O    O',
  floor_number: '     .    .    .    O    .    O    .    .    .    .    .    O',
  floors: '           .    O    O    O    .    .    .    .    .    O    O    O',
  maintenance_fee: '  O    O    O    O    .    O    O    O    O    O    O    O',
  is_furnished: '     R    R    R    R    .    .    O    .    .    .    .    O',
  has_terrace: '      R    R    R    R    .    .    O    .    .    .    .    O',
  amenities: '        R    R    R    R    .    .    .    .    .    .    .    O',
  applies_traspaso: ' .    .    .    .    .    .    R    .    .    .    .    .',
};

function decodeRow(row: string): Record<PropertyTypeValue, PropertyFieldRequirement> {
  const cells = row.replace(/\s+/g, '');
  if (cells.length !== MATRIX_COLUMNS.length) {
    // Guards against a mis-aligned edit silently shifting a whole row by one
    // column, which would make an unrelated type require the wrong field.
    throw new Error(
      `property-fields: fila de la matriz con ${cells.length} celdas, se esperaban ${MATRIX_COLUMNS.length}`,
    );
  }
  const out = {} as Record<PropertyTypeValue, PropertyFieldRequirement>;
  MATRIX_COLUMNS.forEach((type, i) => {
    const cell = cells[i];
    out[type] =
      cell === 'R' ? 'REQUIRED' : cell === 'O' ? 'OPTIONAL' : 'HIDDEN';
    if (cell !== 'R' && cell !== 'O' && cell !== '.') {
      throw new Error(`property-fields: celda inválida "${cell}" en la matriz`);
    }
  });
  return out;
}

/**
 * The transcribed matrix, indexed `[field][type]`.
 *
 * Source: the client's "DATOS DEL INMUEBLE × TIPO DE PROPIEDAD" image.
 */
export const PROPERTY_FIELD_MATRIX: Record<
  PropertyFieldKey,
  Record<PropertyTypeValue, PropertyFieldRequirement>
> = Object.fromEntries(
  PROPERTY_FIELD_KEYS.map((field) => [field, decodeRow(MATRIX_ROWS[field])]),
) as Record<PropertyFieldKey, Record<PropertyTypeValue, PropertyFieldRequirement>>;

/* ------------------------------------------------------------------ */
/*  Lookups                                                            */
/* ------------------------------------------------------------------ */

/** Normalise a raw `properties.type` (may arrive lower-cased or spaced). */
function asPropertyType(type: string | null | undefined): PropertyTypeValue | null {
  if (!type) return null;
  const value = type.toUpperCase().replace(/\s+/g, '_');
  return (PROPERTY_TYPES as readonly string[]).includes(value)
    ? (value as PropertyTypeValue)
    : null;
}

/**
 * Requirement of `field` for `type`.
 *
 * An unknown / not-yet-chosen type reports HIDDEN so a form with no type
 * selected renders no conditional fields at all.
 */
export function getFieldRequirement(
  field: PropertyFieldKey,
  type: string | null | undefined,
): PropertyFieldRequirement {
  const known = asPropertyType(type);
  if (!known) return 'HIDDEN';
  return PROPERTY_FIELD_MATRIX[field][known];
}

export function isFieldVisible(
  field: PropertyFieldKey,
  type: string | null | undefined,
): boolean {
  return getFieldRequirement(field, type) !== 'HIDDEN';
}

export function isFieldRequired(
  field: PropertyFieldKey,
  type: string | null | undefined,
): boolean {
  return getFieldRequirement(field, type) === 'REQUIRED';
}

/** Visible fields for `type`, in the row order of the client's matrix. */
export function getVisibleFields(type: string | null | undefined): PropertyFieldKey[] {
  return PROPERTY_FIELD_KEYS.filter((field) => isFieldVisible(field, type));
}

/** Required fields for `type`, in the row order of the client's matrix. */
export function getRequiredFields(type: string | null | undefined): PropertyFieldKey[] {
  return PROPERTY_FIELD_KEYS.filter((field) => isFieldRequired(field, type));
}

/** Label for `field`, honouring the per-type overrides (hotel, edificio…). */
export function getPropertyFieldLabel(
  field: PropertyFieldKey,
  type: string | null | undefined,
): string {
  const meta = PROPERTY_FIELD_META[field];
  const known = asPropertyType(type);
  return (known && meta.labelByType?.[known]) || meta.label;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/**
 * A value map keyed by matrix field.
 *
 * Numbers accept the raw string an `<input type="number">` produces so the
 * same validator can run against form state and against a DB payload.
 * Tri-state answers are `boolean | null` — `null`/`undefined` mean unanswered.
 */
export interface PropertyFieldValueMap {
  price?: number | string | null;
  currency?: string | null;
  area_built?: number | string | null;
  area_total?: number | string | null;
  bedrooms?: number | string | null;
  private_units?: number | string | null;
  bathrooms?: number | string | null;
  half_bathrooms?: number | string | null;
  parking_spaces?: number | string | null;
  age_years?: number | string | null;
  floor_number?: number | string | null;
  floors?: number | string | null;
  maintenance_fee?: number | string | null;
  is_furnished?: boolean | null;
  has_terrace?: boolean | null;
  /** Selected common areas. An empty array is a valid answer. */
  amenities?: string[] | null;
  /** Explicit confirmation of the amenities selection ("forzar a responder"). */
  amenities_answered?: boolean | null;
  applies_traspaso?: boolean | null;
}

export interface PropertyFieldError {
  field: PropertyFieldKey;
  message: string;
}

/** Parse a numeric cell; returns null when blank or not a number. */
export function parseFieldNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateNumericField(
  field: PropertyFieldKey,
  raw: number | string | null | undefined,
  required: boolean,
): PropertyFieldError | null {
  const meta = PROPERTY_FIELD_META[field];
  const parsed = parseFieldNumber(raw);

  if (parsed === null) {
    return required ? { field, message: meta.requiredMessage } : null;
  }
  if (parsed < 0) {
    return { field, message: `${meta.label} no puede ser negativo.` };
  }
  if (!meta.allowsZero && parsed === 0) {
    return { field, message: `${meta.label} debe ser mayor a 0.` };
  }
  if (meta.integer && !Number.isInteger(parsed)) {
    return { field, message: `${meta.label} debe ser un número entero.` };
  }
  if (meta.max !== undefined && parsed > meta.max) {
    return { field, message: `${meta.label} no puede exceder ${meta.max}.` };
  }
  return null;
}

/**
 * Validate `values` against the matrix row for `type`.
 *
 * Hidden fields are skipped entirely (a leftover value from a previously
 * selected type must be cleared, not reported — see the form's
 * `clearHiddenFieldValues`). Optional fields are still range-checked when
 * present, so a typo cannot reach the database.
 */
export function validatePropertyFields(
  type: string | null | undefined,
  values: PropertyFieldValueMap,
): PropertyFieldError[] {
  const errors: PropertyFieldError[] = [];

  for (const field of PROPERTY_FIELD_KEYS) {
    const requirement = getFieldRequirement(field, type);
    if (requirement === 'HIDDEN') continue;
    const required = requirement === 'REQUIRED';
    const meta = PROPERTY_FIELD_META[field];

    switch (meta.kind) {
      case 'currency':
      case 'number': {
        const error = validateNumericField(
          field,
          values[field] as number | string | null | undefined,
          required,
        );
        if (error) errors.push(error);
        break;
      }
      case 'currency-code': {
        const code = (values.currency ?? '').toString().trim();
        if (!code && required) {
          errors.push({ field, message: meta.requiredMessage });
        }
        break;
      }
      case 'tristate': {
        const answer = values[field as 'is_furnished' | 'has_terrace' | 'applies_traspaso'];
        // Only `true` and `false` count as answered: `null`/`undefined` mean
        // the publisher never picked Sí or No.
        if (required && answer !== true && answer !== false) {
          errors.push({ field, message: meta.requiredMessage });
        }
        break;
      }
      case 'amenities': {
        // "Forzar a responder" on a multi-select means confirming the
        // selection, NOT selecting at least one: "sin amenidades" is a valid
        // answer that the publisher still has to give.
        if (required && values.amenities_answered !== true) {
          errors.push({ field, message: meta.requiredMessage });
        }
        break;
      }
    }
  }

  return errors;
}
