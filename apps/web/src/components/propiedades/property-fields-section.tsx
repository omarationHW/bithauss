"use client";

/* ------------------------------------------------------------------ */
/*  Conditional listing fields, driven by the client's matrix          */
/*                                                                     */
/*  "cuando pides la información, la información cambia por tipo de    */
/*   inmueble […] el verde indica que es forzoso."                     */
/*                                                                     */
/*  Alta (/dashboard/propiedades/nueva) and edición                    */
/*  (/dashboard/propiedades/[id]/editar) used to each carry their own  */
/*  copy of the per-type branches — four hand-written blocks apiece,   */
/*  already out of sync with one another. They now share this module,  */
/*  which renders whatever PROPERTY_FIELD_MATRIX says, in the row      */
/*  order and with the labels of the client's image.                   */
/* ------------------------------------------------------------------ */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PROPERTY_FIELD_META,
  getPropertyFieldLabel,
  getVisibleFields,
  isFieldRequired,
  isFieldVisible,
  validatePropertyFields,
  type PropertyFieldError,
  type PropertyFieldKey,
} from "@/lib/property-fields";

/* ------------------------------------------------------------------ */
/*  Value shape                                                        */
/* ------------------------------------------------------------------ */

/**
 * The matrix rows this section owns.
 *
 * `price` / `currency` (rows 1–2) and `amenities` (row 16) are deliberately
 * absent: they are captured by the "Precio" and "Amenidades" cards, which
 * carry rules the matrix does not model (a VENTA_RENTA listing has two
 * amounts; amenities are 21 checkboxes). Their matrix requirement is still
 * enforced — `validatePropertyFieldValues` takes them through `context`.
 *
 * Numerics stay as strings because that is what `<input type="number">`
 * produces; "" means "not captured", which is NOT the same as 0.
 */
export interface PropertyFieldValues {
  area_built: string;
  area_total: string;
  bedrooms: string;
  private_units: string;
  bathrooms: string;
  half_bathrooms: string;
  parking_spaces: string;
  age_years: string;
  floor_number: string;
  floors: string;
  maintenance_fee: string;
  /** Tri-state: null = the publisher has not answered Sí/No yet. */
  is_furnished: boolean | null;
  has_terrace: boolean | null;
  applies_traspaso: boolean | null;
}

/** Rows rendered by this section, in the order of the client's image. */
export const SECTION_FIELD_KEYS = [
  "area_built",
  "area_total",
  "bedrooms",
  "private_units",
  "bathrooms",
  "half_bathrooms",
  "parking_spaces",
  "age_years",
  "floor_number",
  "floors",
  "maintenance_fee",
  "is_furnished",
  "has_terrace",
  "applies_traspaso",
] as const satisfies readonly PropertyFieldKey[];

export type SectionFieldKey = (typeof SECTION_FIELD_KEYS)[number];

export const EMPTY_PROPERTY_FIELD_VALUES: PropertyFieldValues = {
  area_built: "",
  area_total: "",
  bedrooms: "",
  private_units: "",
  bathrooms: "",
  half_bathrooms: "",
  parking_spaces: "",
  age_years: "",
  floor_number: "",
  floors: "",
  maintenance_fee: "",
  is_furnished: null,
  has_terrace: null,
  applies_traspaso: null,
};

/** The parts of the matrix captured outside this section. */
export interface PropertyMatrixContext {
  /** Effective amount for the chosen operation (Precio card). */
  price: string;
  /** Currency code (Precio card). */
  currency: string;
  /** Selected common areas (Amenidades card). */
  amenities: string[];
  /** The publisher confirmed the amenities selection (Amenidades card). */
  amenitiesAnswered: boolean;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (unit-tested)                                         */
/* ------------------------------------------------------------------ */

/** DOM id of a field's control — also the focus target for its error. */
export function propertyFieldDomId(field: PropertyFieldKey): string {
  return `pf-${field}`;
}

const TRISTATE_FIELDS = [
  "is_furnished",
  "has_terrace",
  "applies_traspaso",
] as const satisfies readonly SectionFieldKey[];

function isTristate(field: SectionFieldKey): field is (typeof TRISTATE_FIELDS)[number] {
  return (TRISTATE_FIELDS as readonly string[]).includes(field);
}

/**
 * Blank every value the matrix hides for `type`.
 *
 * Without this, switching a listing from Casa to Terreno would still persist
 * the recámaras, baños and "Amueblado: Sí" captured for the house — data that
 * is not merely unused but wrong for the new type.
 */
export function clearHiddenFieldValues(
  type: string,
  values: PropertyFieldValues,
): PropertyFieldValues {
  const next = { ...values };
  for (const field of SECTION_FIELD_KEYS) {
    if (isFieldVisible(field, type)) continue;
    if (isTristate(field)) next[field] = null;
    else next[field] = "";
  }
  return next;
}

/**
 * The amenities card is itself conditional (the matrix only shows it for the
 * residential types), so its answer has to be cleared the same way.
 */
export function clearHiddenAmenities(
  type: string,
  amenities: string[],
  amenitiesAnswered: boolean,
): { amenities: string[]; amenitiesAnswered: boolean } {
  if (isFieldVisible("amenities", type)) {
    return { amenities, amenitiesAnswered };
  }
  return { amenities: [], amenitiesAnswered: false };
}

/** Run the matrix rules over the form state. Returns errors in row order. */
export function validatePropertyFieldValues(
  type: string,
  values: PropertyFieldValues,
  context: PropertyMatrixContext,
): PropertyFieldError[] {
  return validatePropertyFields(type, {
    price: context.price,
    currency: context.currency,
    amenities: context.amenities,
    amenities_answered: context.amenitiesAnswered,
    ...values,
  });
}

/**
 * Map the form state onto `properties` columns.
 *
 * Hidden rows are written as explicit nulls rather than left out: an UPDATE
 * that omits them would keep whatever the previous type had stored.
 */
export function propertyFieldValuesToDb(
  type: string,
  values: PropertyFieldValues,
): Record<string, number | boolean | null> {
  const payload: Record<string, number | boolean | null> = {};
  for (const field of SECTION_FIELD_KEYS) {
    if (!isFieldVisible(field, type)) {
      payload[field] = null;
      continue;
    }
    if (isTristate(field)) {
      payload[field] = values[field];
      continue;
    }
    const raw = values[field].trim();
    const parsed = raw === "" ? null : Number(raw);
    payload[field] = parsed !== null && Number.isFinite(parsed) ? parsed : null;
  }
  return payload;
}

/** Read a `properties` row back into form state. */
export function propertyFieldValuesFromDb(
  row: Record<string, unknown>,
): PropertyFieldValues {
  const num = (key: SectionFieldKey): string => {
    const value = row[key];
    return value === null || value === undefined ? "" : String(value);
  };
  const bool = (key: SectionFieldKey): boolean | null => {
    const value = row[key];
    return value === true || value === false ? value : null;
  };
  return {
    area_built: num("area_built"),
    area_total: num("area_total"),
    bedrooms: num("bedrooms"),
    private_units: num("private_units"),
    bathrooms: num("bathrooms"),
    half_bathrooms: num("half_bathrooms"),
    parking_spaces: num("parking_spaces"),
    age_years: num("age_years"),
    floor_number: num("floor_number"),
    floors: num("floors"),
    maintenance_fee: num("maintenance_fee"),
    is_furnished: bool("is_furnished"),
    has_terrace: bool("has_terrace"),
    applies_traspaso: bool("applies_traspaso"),
  };
}

/**
 * Move focus to the first field the matrix rejected.
 *
 * Errors arrive in matrix-row order, so the first one is also the topmost
 * control on screen — the publisher lands where they need to type.
 */
export function focusFirstInvalidField(errors: PropertyFieldError[]): void {
  const first = errors[0];
  if (!first || typeof document === "undefined") return;
  const el = document.getElementById(propertyFieldDomId(first.field));
  if (el instanceof HTMLElement) {
    el.focus();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/* ------------------------------------------------------------------ */
/*  Controls                                                           */
/* ------------------------------------------------------------------ */

function RequiredMark({ required }: { required: boolean }) {
  return required ? (
    <span className="text-red-500" aria-hidden="true">
      {" "}
      *
    </span>
  ) : (
    <span className="text-xs font-normal text-gray-400"> (opcional)</span>
  );
}

/**
 * Sí / No control for the matrix's "Checkbox, forzar a responder" rows.
 *
 * A plain checkbox is wrong here: it starts unticked, so saving without
 * touching it records "No" — an answer the publisher never gave. Two radios
 * with no preselection make "sin responder" a state the form can detect and
 * refuse.
 */
export function TriStateField({
  field,
  label,
  value,
  onChange,
  required,
  error,
}: {
  field: PropertyFieldKey;
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  required: boolean;
  error?: string;
}) {
  const id = propertyFieldDomId(field);
  const name = `${id}-answer`;
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;

  return (
    <fieldset className="min-w-0">
      <legend id={labelId} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        <RequiredMark required={required} />
      </legend>
      <div
        className="flex gap-2"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {[
          { answer: true, text: "Sí" },
          { answer: false, text: "No" },
        ].map(({ answer, text }, index) => {
          const checked = value === answer;
          return (
            <label
              key={text}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                checked
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                // Only the first radio carries the field id: it is the focus
                // target when the matrix reports this row as unanswered.
                id={index === 0 ? id : undefined}
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(answer)}
              />
              {text}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function NumericField({
  field,
  label,
  unit,
  value,
  onChange,
  required,
  error,
}: {
  field: PropertyFieldKey;
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  required: boolean;
  error?: string;
}) {
  const id = propertyFieldDomId(field);
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="mb-1.5 block text-gray-700">
        {label}
        {unit ? ` (${unit})` : ""}
        <RequiredMark required={required} />
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder="0"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-xl"
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Amenities confirmation ("forzar a responder" applied to a multi-select).
 *
 * Rendered inside the Amenidades card by both pages, because the question is
 * about that card's 21 checkboxes. "Sin amenidades" is a real answer, so this
 * confirms the selection instead of demanding a non-empty one.
 */
export function AmenitiesAnsweredField({
  answered,
  onChange,
  selectedCount,
  required,
  error,
}: {
  answered: boolean;
  onChange: (value: boolean) => void;
  selectedCount: number;
  required: boolean;
  error?: string;
}) {
  const id = propertyFieldDomId("amenities");
  const errorId = `${id}-error`;

  return (
    <div className="mt-5 rounded-xl bg-gray-50 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={answered}
          onChange={(e) => onChange(e.target.checked)}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border-gray-300"
        />
        <span className="text-sm">
          <span className="block font-medium text-gray-700">
            Confirmo las amenidades de esta propiedad
            <RequiredMark required={required} />
          </span>
          <span className="block text-xs text-gray-500">
            {selectedCount === 0
              ? "No seleccionaste ninguna: marca esta casilla para confirmar que la propiedad no tiene amenidades."
              : `Seleccionaste ${selectedCount} ${selectedCount === 1 ? "amenidad" : "amenidades"}.`}
          </span>
        </span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

/**
 * Renders the matrix rows for `type`.
 *
 * Numeric rows go in a grid, the "forzar a responder" rows below them — the
 * relative order of the image is preserved within each group, and the two
 * groups need different controls, so mixing them in one grid would be worse.
 */
export function PropertyFieldsSection({
  type,
  values,
  onChange,
  errors,
}: {
  type: string;
  values: PropertyFieldValues;
  onChange: <K extends SectionFieldKey>(field: K, value: PropertyFieldValues[K]) => void;
  errors: PropertyFieldError[];
}) {
  const visible = getVisibleFields(type).filter((field): field is SectionFieldKey =>
    (SECTION_FIELD_KEYS as readonly string[]).includes(field),
  );
  const numericFields = visible.filter((field) => !isTristate(field));
  const tristateFields = visible.filter(isTristate);

  const errorFor = (field: PropertyFieldKey): string | undefined =>
    errors.find((e) => e.field === field)?.message;

  if (visible.length === 0) return null;

  return (
    <div className="space-y-6">
      {numericFields.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {numericFields.map((field) => (
            <NumericField
              key={field}
              field={field}
              label={getPropertyFieldLabel(field, type)}
              unit={PROPERTY_FIELD_META[field].unit}
              value={values[field]}
              onChange={(value) => onChange(field, value)}
              required={isFieldRequired(field, type)}
              error={errorFor(field)}
            />
          ))}
        </div>
      )}

      {tristateFields.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tristateFields.map((field) => (
            <TriStateField
              key={field}
              field={field}
              label={getPropertyFieldLabel(field, type)}
              value={values[field]}
              onChange={(value) => onChange(field, value)}
              required={isFieldRequired(field, type)}
              error={errorFor(field)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
