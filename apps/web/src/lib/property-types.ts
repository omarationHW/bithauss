/* ------------------------------------------------------------------ */
/*  Property type behaviour                                            */
/*                                                                     */
/*  The forms used to compare `tipo_propiedad` with === "CASA" /       */
/*  === "DEPARTAMENTO", which silently dropped CASA_CONDOMINIO,        */
/*  HOTEL and EDIFICIO into the generic (land/warehouse) branch.       */
/*  These helpers are the single source of truth for which fields      */
/*  each type shows and persists, shared by alta and edición.          */
/* ------------------------------------------------------------------ */

/**
 * Types that behave like a house (land + construction, levels, rooms).
 * CASA_USO_SUELO is a house zoned for commercial use — the zoning changes what
 * you may do with it, not how it is described.
 */
export const HOUSE_TYPES = ["CASA", "CASA_CONDOMINIO", "CASA_USO_SUELO"] as const;
/** Types that behave like an apartment (built area, floor, maintenance). */
export const APARTMENT_TYPES = ["DEPARTAMENTO"] as const;
/** Types inside a condominium where a maintenance fee always applies. */
export const CONDO_TYPES = ["CASA_CONDOMINIO", "DEPARTAMENTO"] as const;
/**
 * Whole-building types: traded as a single asset, so they are described by
 * land/construction area, levels, parking and a unit count — never by a floor
 * number or a maintenance fee, since the buyer owns the whole building.
 */
export const BUILDING_TYPES = ["HOTEL", "EDIFICIO"] as const;

export interface PropertyTypeFlags {
  /** House-like: casa or casa en condominio. */
  isCasa: boolean;
  /** Apartment-like. */
  isDepto: boolean;
  /** A whole hotel. */
  isHotel: boolean;
  /** A whole apartment/office building. */
  isEdificio: boolean;
  /** Either whole-building type — both share the same form block. */
  isBuilding: boolean;
  /** Shows the private-features block (service room, terrace, ...). */
  isResidential: boolean;
  /** Maintenance fee applies (condominium or apartment). */
  showMaintenanceFee: boolean;
  /** "Piso en el que está" applies. */
  showFloorNumber: boolean;
  /**
   * Label for the count stored in `bedrooms`. Whole-building types reuse that
   * column so the DB schema stays unchanged, but "recámaras" is wrong for a
   * hotel (habitaciones) or a building (unidades).
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
    isResidential: isCasa || isDepto,
    showMaintenanceFee: (CONDO_TYPES as readonly string[]).includes(value),
    showFloorNumber: isDepto,
    unitCountLabel: isHotel
      ? "Habitaciones"
      : isEdificio
        ? "Departamentos / Unidades"
        : "Recámaras",
  };
}
