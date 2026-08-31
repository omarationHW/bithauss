/* ------------------------------------------------------------------ */
/*  Operation labels                                                   */
/*                                                                     */
/*  The public detail page and the ficha técnica each carried their own */
/*  `operationLabel`, differing only in capitalisation — so a new       */
/*  operation had to be added twice and one of them was always missed.  */
/* ------------------------------------------------------------------ */

import {
  ALL_PROPERTY_OPERATIONS,
  PROPERTY_OPERATIONS,
  isLegacyPropertyOperation,
} from "@bithauss/validators";

export { PROPERTY_OPERATIONS, ALL_PROPERTY_OPERATIONS, isLegacyPropertyOperation };

/**
 * Human label for a `properties.operation` value.
 *
 * TRASPASO is a RETIRED operation: it can no longer be chosen when publishing
 * (it became the "¿Aplica traspaso?" attribute of a Local Comercial), but rows
 * published before the change still carry it. Dropping it from this map would
 * make those listings render a raw enum value, so it stays — read-only.
 */
const OPERATION_LABELS: Record<string, string> = {
  VENTA: "En venta",
  RENTA: "En renta",
  VENTA_RENTA: "Venta y renta",
  TRASPASO: "En traspaso",
};

/** Falls back to the raw value so an unknown enum member is still visible. */
export function propertyOperationLabel(operation: string | null | undefined): string {
  if (!operation) return "";
  return OPERATION_LABELS[operation.toUpperCase()] ?? operation;
}

/** Short tag used on cards and badges ("Venta", "Renta", …). */
export function propertyOperationTag(operation: string | null | undefined): string {
  const op = (operation ?? "").toUpperCase();
  if (op === "RENTA") return "Renta";
  if (op === "VENTA_RENTA") return "Venta y renta";
  if (op === "TRASPASO") return "Traspaso";
  return "Venta";
}
