/* ------------------------------------------------------------------ */
/*  Property type behaviour                                            */
/*                                                                     */
/*  The forms used to compare `tipo_propiedad` with === "CASA" /       */
/*  === "DEPARTAMENTO", which silently dropped CASA_CONDOMINIO,        */
/*  HOTEL and EDIFICIO into the generic (land/warehouse) branch.       */
/*                                                                     */
/*  Since the client sent the "DATOS DEL INMUEBLE × TIPO DE PROPIEDAD" */
/*  matrix, the matrix — not this file — decides WHICH fields a type   */
/*  shows. Every flag below that answers "does this type show field    */
/*  X?" is therefore DERIVED from it (see ./property-fields), so a     */
/*  change to the matrix can never leave these flags behind.           */
/*                                                                     */
/*  What stays hand-written are the *identity* groupings (is this a    */
/*  house? a whole building?), which express what an asset IS rather   */
/*  than which inputs it renders, and which the matrix does not encode.*/
/* ------------------------------------------------------------------ */

import {
  getPropertyFieldLabel,
  isFieldVisible,
} from "./property-fields";

/**
 * Types that behave like a house (land + construction, levels, rooms).
 * CASA_USO_SUELO is a house zoned for commercial use — the zoning changes what
 * you may do with it, not how it is described.
 */
export const HOUSE_TYPES = ["CASA", "CASA_CONDOMINIO", "CASA_USO_SUELO"] as const;
/** Types that behave like an apartment (built area, floor, maintenance). */
export const APARTMENT_TYPES = ["DEPARTAMENTO"] as const;
/**
 * Types inside a condominium.
 *
 * Kept for callers that need the grouping itself; the maintenance-fee flag no
 * longer derives from it, because the matrix shows "Cuota de mantenimiento"
 * for every type except Terreno.
 */
export const CONDO_TYPES = ["CASA_CONDOMINIO", "DEPARTAMENTO"] as const;
/**
 * Whole-building types: traded as a single asset, so they are described by
 * land/construction area, levels, parking and a unit count — never by a floor
 * number, since the buyer owns the whole building.
 */
export const BUILDING_TYPES = ["HOTEL", "EDIFICIO"] as const;

export interface PropertyTypeFlags {
  /** House-like: casa, casa en condominio or casa con uso de suelo. */
  isCasa: boolean;
  /** Apartment-like. */
  isDepto: boolean;
  /** A whole hotel. */
  isHotel: boolean;
  /** A whole apartment/office building. */
  isEdificio: boolean;
  /** Either whole-building type — both share the same form block. */
  isBuilding: boolean;
  /**
   * Shows the extra private-features block (cuarto de servicio, bodega,
   * cuarto de lavado, cocina integral).
   *
   * Derived from the matrix row "Amueblado": the types the client asks about
   * furnishing are exactly the ones whose interior fit-out is worth
   * describing — casa, casa en condominio, casa con uso de suelo,
   * departamento and local comercial.
   *
   * NOTE: "Terraza" left this block. It is a matrix row now ("forzar a
   * responder"), so it is rendered as a Sí/No control by the shared field
   * section — two controls writing `has_terrace` would fight each other.
   */
  isResidential: boolean;
  /** Matrix row "Cuota de mantenimiento" applies. */
  showMaintenanceFee: boolean;
  /** Matrix row "Nivel en el que se encuentra" applies. */
  showFloorNumber: boolean;
  /**
   * Label for this type's unit count.
   *
   * @deprecated Read the label straight from the matrix with
   * `getPropertyFieldLabel('bedrooms' | 'private_units', type)`. Kept so the
   * flag object stays source-compatible for any caller still destructuring it.
   */
  unitCountLabel: string;
}

/** Derive the conditional-field flags for a `properties.type` value. */
export function getPropertyTypeFlags(type: string): PropertyTypeFlags {
  const value = (type || "").toUpperCase();
  const isCasa = (HOUSE_TYPES as readonly string[]).includes(value);
  const isDepto = (APARTMENT_TYPES as readonly string[]).includes(value);
  const isHotel = value === "HOTEL";
  const isEdificio = value === "EDIFICIO";

  return {
    isCasa,
    isDepto,
    isHotel,
    isEdificio,
    isBuilding: (BUILDING_TYPES as readonly string[]).includes(value),
    isResidential: isFieldVisible("is_furnished", value),
    showMaintenanceFee: isFieldVisible("maintenance_fee", value),
    showFloorNumber: isFieldVisible("floor_number", value),
    unitCountLabel: isFieldVisible("private_units", value)
      ? getPropertyFieldLabel("private_units", value)
      : getPropertyFieldLabel("bedrooms", value),
  };
}
