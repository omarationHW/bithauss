import { describe, it, expect } from "vitest";

import {
  PROPERTY_FIELD_KEYS,
  PROPERTY_FIELD_MATRIX,
  getFieldRequirement,
  getPropertyFieldLabel,
  getRequiredFields,
  getVisibleFields,
  isFieldRequired,
  isFieldVisible,
  validatePropertyFields,
  type PropertyFieldKey,
} from "./property-fields";
import { getPropertyTypeFlags } from "./property-types";

/* ------------------------------------------------------------------ */
/*  The matrix, re-stated independently                                */
/*                                                                     */
/*  Transcribed from the client's image a SECOND time, as per-type      */
/*  field lists rather than as rows. If either transcription is wrong,  */
/*  the two disagree and this suite fails — a row-shaped typo cannot    */
/*  be reproduced identically in column shape by accident.              */
/* ------------------------------------------------------------------ */

/** Every field a type shows, split by whether the cell was green. */
const EXPECTED: Record<string, { required: PropertyFieldKey[]; optional: PropertyFieldKey[] }> = {
  CASA: {
    required: ["price", "currency", "area_built", "area_total", "bedrooms", "is_furnished", "has_terrace", "amenities"],
    optional: ["bathrooms", "half_bathrooms", "parking_spaces", "age_years", "maintenance_fee"],
  },
  CASA_CONDOMINIO: {
    required: ["price", "currency", "area_built", "area_total", "bedrooms", "is_furnished", "has_terrace", "amenities"],
    optional: ["bathrooms", "half_bathrooms", "parking_spaces", "age_years", "floors", "maintenance_fee"],
  },
  CASA_USO_SUELO: {
    required: ["price", "currency", "area_built", "area_total", "is_furnished", "has_terrace", "amenities"],
    optional: ["bathrooms", "half_bathrooms", "parking_spaces", "age_years", "floors", "maintenance_fee"],
  },
  DEPARTAMENTO: {
    required: ["price", "currency", "area_built", "bedrooms", "is_furnished", "has_terrace", "amenities"],
    optional: [
      "bathrooms",
      "half_bathrooms",
      "parking_spaces",
      "age_years",
      "floor_number",
      "floors",
      "maintenance_fee",
    ],
  },
  TERRENO: {
    required: ["price", "currency", "area_total"],
    optional: ["age_years"],
  },
  OFICINA: {
    required: ["price", "currency", "area_built", "private_units"],
    optional: [
      "area_total",
      "bathrooms",
      "half_bathrooms",
      "parking_spaces",
      "age_years",
      "floor_number",
      "maintenance_fee",
    ],
  },
  LOCAL_COMERCIAL: {
    required: ["price", "currency", "area_built", "private_units", "applies_traspaso"],
    optional: [
      "area_total",
      "bathrooms",
      "half_bathrooms",
      "parking_spaces",
      "age_years",
      "maintenance_fee",
      "is_furnished",
      "has_terrace",
    ],
  },
  BODEGA: {
    required: ["price", "currency", "area_built", "area_total", "private_units"],
    optional: ["bathrooms", "half_bathrooms", "parking_spaces", "age_years", "maintenance_fee"],
  },
  NAVE_INDUSTRIAL: {
    required: ["price", "currency", "area_built", "area_total"],
    optional: [
      "private_units",
      "bathrooms",
      "half_bathrooms",
      "parking_spaces",
      "age_years",
      "maintenance_fee",
    ],
  },
  HOTEL: {
    required: ["price", "currency", "area_built", "area_total", "bedrooms"],
    optional: [
      "bathrooms",
      "half_bathrooms",
      "parking_spaces",
      "age_years",
      "floors",
      "maintenance_fee",
    ],
  },
  EDIFICIO: {
    required: ["price", "currency", "area_built", "area_total", "private_units"],
    optional: [
      "bathrooms",
      "half_bathrooms",
      "parking_spaces",
      "age_years",
      "floors",
      "maintenance_fee",
    ],
  },
};

/** Matrix-row order, so assertions can compare sorted-by-row lists. */
function inRowOrder(fields: PropertyFieldKey[]): PropertyFieldKey[] {
  return PROPERTY_FIELD_KEYS.filter((f) => fields.includes(f));
}

describe("PROPERTY_FIELD_MATRIX — transcripción de la imagen del cliente", () => {
  for (const [type, expected] of Object.entries(EXPECTED)) {
    describe(type, () => {
      it("muestra exactamente los campos de la matriz", () => {
        expect(getVisibleFields(type)).toEqual(
          inRowOrder([...expected.required, ...expected.optional]),
        );
      });

      it("marca como obligatorios sólo los campos en verde", () => {
        expect(getRequiredFields(type)).toEqual(inRowOrder(expected.required));
      });

      it("oculta todo lo demás", () => {
        const shown = new Set<string>([...expected.required, ...expected.optional]);
        for (const field of PROPERTY_FIELD_KEYS) {
          if (shown.has(field)) continue;
          expect(getFieldRequirement(field, type)).toBe("HIDDEN");
        }
      });
    });
  }

  it("cubre los 11 tipos de la imagen y las 17 filas", () => {
    expect(Object.keys(EXPECTED)).toHaveLength(11);
    expect(PROPERTY_FIELD_KEYS).toHaveLength(17);
  });

  it("pide precio y moneda en todos los tipos de la imagen", () => {
    for (const type of Object.keys(EXPECTED)) {
      expect(isFieldRequired("price", type)).toBe(true);
      expect(isFieldRequired("currency", type)).toBe(true);
    }
  });

  it("'¿Aplica traspaso?' sólo existe para Local Comercial", () => {
    for (const type of Object.keys(EXPECTED)) {
      expect(isFieldVisible("applies_traspaso", type)).toBe(type === "LOCAL_COMERCIAL");
    }
    expect(getFieldRequirement("applies_traspaso", "LOCAL_COMERCIAL")).toBe("REQUIRED");
  });

  it("separa recámaras de privados: hotel cuenta habitaciones, edificio unidades", () => {
    // The old forms stored a building's unit count in `bedrooms`; the matrix
    // gives commercial types their own row.
    expect(isFieldVisible("bedrooms", "HOTEL")).toBe(true);
    expect(isFieldVisible("private_units", "HOTEL")).toBe(false);
    expect(isFieldVisible("bedrooms", "EDIFICIO")).toBe(false);
    expect(isFieldVisible("private_units", "EDIFICIO")).toBe(true);
    expect(getPropertyFieldLabel("bedrooms", "HOTEL")).toBe("No. de habitaciones");
    expect(getPropertyFieldLabel("bedrooms", "CASA")).toBe("No. de recámaras");
    expect(getPropertyFieldLabel("private_units", "EDIFICIO")).toBe(
      "No. de departamentos / unidades",
    );
  });

  it("Terreno no pide superficie construida ni baños", () => {
    expect(isFieldVisible("area_built", "TERRENO")).toBe(false);
    expect(isFieldVisible("bathrooms", "TERRENO")).toBe(false);
    expect(isFieldVisible("maintenance_fee", "TERRENO")).toBe(false);
  });

  it("un tipo desconocido o vacío no muestra ningún campo condicional", () => {
    expect(getVisibleFields("")).toEqual([]);
    expect(getVisibleFields(undefined)).toEqual([]);
    expect(getVisibleFields("NO_EXISTE")).toEqual([]);
  });

  it("OTRO (fuera de la imagen) es permisivo salvo precio y moneda", () => {
    // Documented fallback: the catch-all type is not in the client's matrix.
    expect(getRequiredFields("OTRO")).toEqual(["price", "currency"]);
    expect(isFieldVisible("applies_traspaso", "OTRO")).toBe(false);
  });

  it("normaliza el tipo (minúsculas, espacios)", () => {
    expect(getFieldRequirement("bedrooms", "casa")).toBe("REQUIRED");
    expect(getFieldRequirement("bedrooms", "local comercial")).toBe("HIDDEN");
  });
});

/* ------------------------------------------------------------------ */
/*  validatePropertyFields                                             */
/* ------------------------------------------------------------------ */

const CASA_OK = {
  price: "5000000",
  currency: "MXN",
  area_built: "180",
  area_total: "250",
  bedrooms: "3",
  is_furnished: false,
  has_terrace: true,
  amenities: [],
  amenities_answered: true,
};

describe("validatePropertyFields", () => {
  it("acepta una casa completa", () => {
    expect(validatePropertyFields("CASA", CASA_OK)).toEqual([]);
  });

  it("acepta un terreno con sólo precio, moneda y superficie", () => {
    expect(
      validatePropertyFields("TERRENO", {
        price: 1_200_000,
        currency: "MXN",
        area_total: 500,
      }),
    ).toEqual([]);
  });

  it("reporta cada obligatorio faltante, en orden de la matriz", () => {
    const errors = validatePropertyFields("CASA", {});
    expect(errors.map((e) => e.field)).toEqual([
      "price",
      "currency",
      "area_built",
      "area_total",
      "bedrooms",
      "is_furnished",
      "has_terrace",
      "amenities",
    ]);
    expect(errors[0]!.message).toBe("Ingresa el precio.");
  });

  it("no reclama campos que la matriz oculta para el tipo", () => {
    const errors = validatePropertyFields("TERRENO", {});
    expect(errors.map((e) => e.field)).toEqual(["price", "currency", "area_total"]);
  });

  it("ignora un valor sobrante de un tipo anterior si el campo está oculto", () => {
    // Bedrooms belong to a Casa, not to a Terreno: the value is stale, and
    // the form clears it — validation must not report it either.
    expect(
      validatePropertyFields("TERRENO", {
        price: "1",
        currency: "MXN",
        area_total: "500",
        bedrooms: "3",
      }),
    ).toEqual([]);
  });

  it("rechaza precio y superficies en cero, pero acepta conteos en cero", () => {
    const zeroPrice = validatePropertyFields("CASA", { ...CASA_OK, price: "0" });
    expect(zeroPrice.map((e) => e.field)).toEqual(["price"]);
    expect(zeroPrice[0]!.message).toContain("mayor a 0");

    // Un estudio tiene 0 recámaras: es una respuesta legítima.
    expect(validatePropertyFields("CASA", { ...CASA_OK, bedrooms: "0" })).toEqual([]);
  });

  it("valida rangos también en campos opcionales", () => {
    const errors = validatePropertyFields("CASA", { ...CASA_OK, bathrooms: "2.5" });
    expect(errors.map((e) => e.field)).toEqual(["bathrooms"]);
    expect(errors[0]!.message).toContain("entero");

    const negative = validatePropertyFields("CASA", { ...CASA_OK, parking_spaces: "-1" });
    expect(negative.map((e) => e.field)).toEqual(["parking_spaces"]);

    const tooOld = validatePropertyFields("CASA", { ...CASA_OK, age_years: "900" });
    expect(tooOld.map((e) => e.field)).toEqual(["age_years"]);
  });

  describe("checkboxes 'forzar a responder' (tri-estado)", () => {
    it("no acepta 'sin responder'", () => {
      for (const unanswered of [undefined, null]) {
        const errors = validatePropertyFields("CASA", {
          ...CASA_OK,
          is_furnished: unanswered,
        });
        expect(errors.map((e) => e.field)).toEqual(["is_furnished"]);
        expect(errors[0]!.message).toBe("Indica si el inmueble está amueblado.");
      }
    });

    it("acepta 'No' como respuesta explícita", () => {
      expect(
        validatePropertyFields("CASA", { ...CASA_OK, is_furnished: false, has_terrace: false }),
      ).toEqual([]);
    });

    it("exige responder '¿Aplica traspaso?' en Local Comercial", () => {
      const base = {
        price: "1",
        currency: "MXN",
        area_built: "80",
        private_units: "2",
      };
      expect(validatePropertyFields("LOCAL_COMERCIAL", base).map((e) => e.field)).toEqual([
        "applies_traspaso",
      ]);
      expect(
        validatePropertyFields("LOCAL_COMERCIAL", { ...base, applies_traspaso: false }),
      ).toEqual([]);
    });

    it("no exige respuesta cuando la matriz marca el checkbox como opcional", () => {
      // Amueblado y Terraza son palomita blanca en Local Comercial.
      expect(
        validatePropertyFields("LOCAL_COMERCIAL", {
          price: "1",
          currency: "MXN",
          area_built: "80",
          private_units: "2",
          applies_traspaso: true,
        }),
      ).toEqual([]);
    });
  });

  describe("amenidades 'forzar a responder'", () => {
    it("exige confirmar la selección, no que sea no vacía", () => {
      const errors = validatePropertyFields("CASA", {
        ...CASA_OK,
        amenities: ["Alberca"],
        amenities_answered: false,
      });
      expect(errors.map((e) => e.field)).toEqual(["amenities"]);
    });

    it("acepta 'sin amenidades' confirmado", () => {
      expect(
        validatePropertyFields("CASA", {
          ...CASA_OK,
          amenities: [],
          amenities_answered: true,
        }),
      ).toEqual([]);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  getPropertyTypeFlags derives from the matrix                       */
/* ------------------------------------------------------------------ */

describe("getPropertyTypeFlags", () => {
  it("deriva showMaintenanceFee de la matriz (todo menos Terreno)", () => {
    expect(getPropertyTypeFlags("CASA").showMaintenanceFee).toBe(true);
    expect(getPropertyTypeFlags("BODEGA").showMaintenanceFee).toBe(true);
    expect(getPropertyTypeFlags("TERRENO").showMaintenanceFee).toBe(false);
  });

  it("deriva showFloorNumber de la matriz (departamento y oficina)", () => {
    expect(getPropertyTypeFlags("DEPARTAMENTO").showFloorNumber).toBe(true);
    expect(getPropertyTypeFlags("OFICINA").showFloorNumber).toBe(true);
    expect(getPropertyTypeFlags("CASA").showFloorNumber).toBe(false);
    expect(getPropertyTypeFlags("EDIFICIO").showFloorNumber).toBe(false);
  });

  it("deriva isResidential de la fila 'Amueblado'", () => {
    expect(getPropertyTypeFlags("CASA_USO_SUELO").isResidential).toBe(true);
    expect(getPropertyTypeFlags("LOCAL_COMERCIAL").isResidential).toBe(true);
    expect(getPropertyTypeFlags("TERRENO").isResidential).toBe(false);
    expect(getPropertyTypeFlags("HOTEL").isResidential).toBe(false);
  });

  it("mantiene las agrupaciones de identidad", () => {
    expect(getPropertyTypeFlags("CASA_CONDOMINIO").isCasa).toBe(true);
    expect(getPropertyTypeFlags("HOTEL").isBuilding).toBe(true);
    expect(getPropertyTypeFlags("EDIFICIO").isBuilding).toBe(true);
    expect(getPropertyTypeFlags("").isCasa).toBe(false);
  });

  it("toma unitCountLabel de la matriz", () => {
    expect(getPropertyTypeFlags("HOTEL").unitCountLabel).toBe("No. de habitaciones");
    expect(getPropertyTypeFlags("EDIFICIO").unitCountLabel).toBe(
      "No. de departamentos / unidades",
    );
    expect(getPropertyTypeFlags("CASA").unitCountLabel).toBe("No. de recámaras");
  });
});

/* ------------------------------------------------------------------ */
/*  Structural invariants                                              */
/* ------------------------------------------------------------------ */

describe("integridad de la tabla", () => {
  it("cada fila tiene una celda por tipo del catálogo", () => {
    for (const field of PROPERTY_FIELD_KEYS) {
      const row = PROPERTY_FIELD_MATRIX[field];
      expect(Object.keys(row)).toHaveLength(12); // 11 de la imagen + OTRO
      for (const requirement of Object.values(row)) {
        expect(["HIDDEN", "OPTIONAL", "REQUIRED"]).toContain(requirement);
      }
    }
  });
});
