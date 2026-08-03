/* ------------------------------------------------------------------ */
/*  Property type behaviour                                            */
/*                                                                     */
/*  The forms used to compare `tipo_propiedad` with === "CASA" /       */
/*  === "DEPARTAMENTO", which silently dropped CASA_CONDOMINIO,        */
/*  HOTEL and DEPARTAMENTO_HOTEL into the generic (land/warehouse)     */
/*  branch. These helpers are the single source of truth for which     */
/*  fields each type shows and persists, shared by alta and edición.   */
/* ------------------------------------------------------------------ */

/** Types that behave like a house (land + construction, levels, rooms). */
export const HOUSE_TYPES = ["CASA", "CASA_CONDOMINIO"] as const;
/** Types that behave like an apartment (built area, floor, maintenance). */
export const APARTMENT_TYPES = ["DEPARTAMENTO", "DEPARTAMENTO_HOTEL"] as const;
/** Types inside a condominium/building where a maintenance fee always applies. */
export const CONDO_TYPES = [
  "CASA_CONDOMINIO",
  "DEPARTAMENTO",
  "DEPARTAMENTO_HOTEL",
] as const;

export interface PropertyTypeFlags {
  /** House-like: casa or casa en condominio. */
  isCasa: boolean;
  /** Apartment-like: departamento or departamento en hotel. */
  isDepto: boolean;
  /** A whole hotel: rooms, bathrooms, levels and parking. */
  isHotel: boolean;
  /** Shows the private-features block (service room, terrace, ...). */
  isResidential: boolean;
  /** Maintenance fee applies (condominium, apartment or hotel unit). */
  showMaintenanceFee: boolean;
  /** "Piso en el que está" applies. */
  showFloorNumber: boolean;
}

/** Derive the conditional-field flags for a `properties.type` value. */
export function getPropertyTypeFlags(type: string): PropertyTypeFlags {
  const value = (type || "").toUpperCase();
  const isCasa = (HOUSE_TYPES as readonly string[]).includes(value);
  const isDepto = (APARTMENT_TYPES as readonly string[]).includes(value);
  const isHotel = value === "HOTEL";

  return {
    isCasa,
    isDepto,
    isHotel,
    isResidential: isCasa || isDepto,
    showMaintenanceFee: (CONDO_TYPES as readonly string[]).includes(value),
    showFloorNumber: isDepto,
  };
}
