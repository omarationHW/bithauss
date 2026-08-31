import { describe, it, expect } from "vitest";
import {
  createPropertySchema,
  propertySearchSchema,
  LEGACY_PROPERTY_OPERATIONS,
} from "@bithauss/validators";

import {
  ALL_PROPERTY_OPERATIONS,
  PROPERTY_OPERATIONS,
  isLegacyPropertyOperation,
  propertyOperationLabel,
  propertyOperationTag,
} from "./property-operations";

/**
 * "en la parte para dar de alta una propiedad sugiero eliminar la opción de
 * Traspaso" — TRASPASO stopped being an operation and became the matrix row
 * "¿Aplica traspaso?" on Local Comercial. It cannot be dropped from the
 * Postgres enum, so historical rows keep carrying it and must keep rendering.
 */
describe("TRASPASO retirado como operación", () => {
  it("ya no se ofrece al publicar", () => {
    expect(PROPERTY_OPERATIONS).toEqual(["VENTA", "RENTA", "VENTA_RENTA"]);
    expect(PROPERTY_OPERATIONS as readonly string[]).not.toContain("TRASPASO");
  });

  it("el esquema de creación lo rechaza", () => {
    const base = {
      title: "Local en Roma Norte",
      type: "LOCAL_COMERCIAL" as const,
      price: 4_500_000,
      currency: "MXN" as const,
      area_built: 90,
      private_units: 2,
      applies_traspaso: true,
      city: "Ciudad de México",
      state: "CDMX",
    };

    const rejected = createPropertySchema.safeParse({ ...base, operation: "TRASPASO" });
    expect(rejected.success).toBe(false);

    // El mismo inmueble, ya modelado como venta con el atributo de traspaso.
    const accepted = createPropertySchema.safeParse({ ...base, operation: "VENTA" });
    expect(accepted.success).toBe(true);
    expect(accepted.success && accepted.data.applies_traspaso).toBe(true);
  });

  it("sigue siendo un valor legado, reconocible y legible", () => {
    expect(LEGACY_PROPERTY_OPERATIONS).toEqual(["TRASPASO"]);
    expect(ALL_PROPERTY_OPERATIONS).toContain("TRASPASO");
    expect(isLegacyPropertyOperation("TRASPASO")).toBe(true);
    expect(isLegacyPropertyOperation("traspaso")).toBe(true);
    expect(isLegacyPropertyOperation("VENTA")).toBe(false);
    expect(isLegacyPropertyOperation(null)).toBe(false);
  });

  it("una propiedad histórica con operation = TRASPASO sigue mostrando su etiqueta", () => {
    expect(propertyOperationLabel("TRASPASO")).toBe("En traspaso");
    expect(propertyOperationTag("TRASPASO")).toBe("Traspaso");
    // Y no cae al valor crudo del enum.
    expect(propertyOperationLabel("TRASPASO")).not.toBe("TRASPASO");
  });

  it("la búsqueda todavía puede filtrar por el valor histórico", () => {
    // Read-only surface: sin esto las propiedades antiguas quedarían
    // inalcanzables desde los filtros.
    expect(propertySearchSchema.safeParse({ operation: "TRASPASO" }).success).toBe(true);
  });

  it("etiqueta correctamente las operaciones vigentes", () => {
    expect(propertyOperationLabel("VENTA")).toBe("En venta");
    expect(propertyOperationLabel("RENTA")).toBe("En renta");
    expect(propertyOperationLabel("VENTA_RENTA")).toBe("Venta y renta");
    expect(propertyOperationLabel(null)).toBe("");
    // Un valor desconocido se muestra tal cual en lugar de desaparecer.
    expect(propertyOperationLabel("FUTURO")).toBe("FUTURO");
  });
});

/**
 * The matrix rules reach the schema too, so the API cannot accept a payload
 * the forms would have rejected.
 */
describe("createPropertySchema aplica la matriz por tipo", () => {
  const casa = {
    title: "Casa en Providencia",
    type: "CASA" as const,
    operation: "VENTA" as const,
    price: 8_000_000,
    currency: "MXN" as const,
    area_built: 220,
    area_total: 300,
    bedrooms: 3,
    is_furnished: false,
    has_terrace: true,
    amenities: [],
    amenities_answered: true,
    city: "Guadalajara",
    state: "Jalisco",
  };

  it("acepta una casa completa", () => {
    expect(createPropertySchema.safeParse(casa).success).toBe(true);
  });

  it("rechaza una casa sin responder 'Amueblado'", () => {
    const withoutAnswer: Record<string, unknown> = { ...casa };
    delete withoutAnswer.is_furnished;
    const result = createPropertySchema.safeParse(withoutAnswer);
    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some(
          (i) =>
            i.path.join(".") === "is_furnished" &&
            i.message === "Indica si el inmueble está amueblado.",
        ),
    ).toBe(true);
  });

  it("rechaza amenidades sin confirmar", () => {
    const result = createPropertySchema.safeParse({
      ...casa,
      amenities: ["Alberca"],
      amenities_answered: false,
    });
    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some((i) => i.path.join(".") === "amenities_answered"),
    ).toBe(true);
  });

  it("rechaza guardar un campo que la matriz oculta para el tipo", () => {
    const result = createPropertySchema.safeParse({
      title: "Terreno en Tulum",
      type: "TERRENO" as const,
      operation: "VENTA" as const,
      price: 2_000_000,
      currency: "MXN" as const,
      area_total: 600,
      bedrooms: 3, // basura de un tipo anterior
      city: "Tulum",
      state: "Quintana Roo",
    });
    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some((i) => i.path.join(".") === "bedrooms"),
    ).toBe(true);
  });

  it("exige responder '¿Aplica traspaso?' sólo en Local Comercial", () => {
    const local = {
      title: "Local en Polanco",
      type: "LOCAL_COMERCIAL" as const,
      operation: "RENTA" as const,
      price_rent: 45_000,
      currency: "MXN" as const,
      area_built: 120,
      private_units: 3,
      city: "Ciudad de México",
      state: "CDMX",
    };
    expect(createPropertySchema.safeParse(local).success).toBe(false);
    expect(
      createPropertySchema.safeParse({ ...local, applies_traspaso: false }).success,
    ).toBe(true);
  });
});
