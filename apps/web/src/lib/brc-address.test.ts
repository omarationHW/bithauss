import { describe, it, expect } from "vitest";
import {
  checkAddressAgainstCatalog,
  composeAddressLine,
  missingBrcAddressFields,
  type PropertyAddress,
} from "./brc-address";

const complete: PropertyAddress = {
  street: "Av. Paseo de la Reforma",
  exterior_number: "222",
  interior_number: null,
  neighborhood: "Juárez",
  zip_code: "06600",
  city: "Cuauhtémoc",
  state: "Ciudad de México",
};

const record06600 = {
  estado: "Ciudad de México",
  municipio: "Cuauhtémoc",
  ciudad: "Ciudad de México",
  colonias: ["Juárez"],
};

describe("composeAddressLine", () => {
  it("joins street and exterior number", () => {
    expect(
      composeAddressLine({ street: "Calle 5", exterior_number: "12-B", interior_number: "" }),
    ).toBe("Calle 5 12-B");
  });

  it("labels the interior number", () => {
    expect(
      composeAddressLine({ street: " Reforma ", exterior_number: "222", interior_number: "5" }),
    ).toBe("Reforma 222 Int. 5");
  });

  it("is empty when nothing was captured", () => {
    expect(composeAddressLine({ street: "", exterior_number: "", interior_number: "" })).toBe("");
  });
});

describe("missingBrcAddressFields", () => {
  it("accepts a complete address", () => {
    expect(missingBrcAddressFields(complete)).toEqual([]);
  });

  it("does not require the interior number", () => {
    expect(missingBrcAddressFields({ ...complete, interior_number: "" })).toEqual([]);
  });

  it("lists every missing field", () => {
    expect(
      missingBrcAddressFields({
        ...complete,
        street: null,
        exterior_number: "  ",
        neighborhood: null,
      }),
    ).toEqual(["Colonia", "Calle", "Número exterior"]);
  });

  it("rejects a malformed postal code", () => {
    expect(missingBrcAddressFields({ ...complete, zip_code: "6600" })).toEqual(["Código postal"]);
  });

  it("flags a legacy listing that only had the free-text line", () => {
    expect(
      missingBrcAddressFields({ ...complete, street: null, exterior_number: null }),
    ).toEqual(["Calle", "Número exterior"]);
  });
});

describe("checkAddressAgainstCatalog", () => {
  it("passes when C.P., estado, alcaldía and colonia agree", () => {
    expect(checkAddressAgainstCatalog(complete, record06600)).toEqual({ errors: [], warnings: [] });
  });

  it("ignores accents and case", () => {
    const r = checkAddressAgainstCatalog(
      { ...complete, city: "CUAUHTEMOC", neighborhood: "juarez" },
      record06600,
    );
    expect(r).toEqual({ errors: [], warnings: [] });
  });

  it("blocks a postal code that does not exist", () => {
    expect(checkAddressAgainstCatalog(complete, null).errors).toHaveLength(1);
  });

  it("blocks a postal code from another alcaldía", () => {
    const r = checkAddressAgainstCatalog({ ...complete, city: "Tlalpan" }, record06600);
    expect(r.errors[0]).toMatch(/pertenece a Cuauhtémoc/);
  });

  it("blocks a postal code from another state", () => {
    const r = checkAddressAgainstCatalog({ ...complete, state: "Jalisco" }, record06600);
    expect(r.errors[0]).toMatch(/pertenece a Ciudad de México/);
  });

  it("asks for the alcaldía when an older listing only has the city", () => {
    const r = checkAddressAgainstCatalog({ ...complete, city: "Ciudad de México" }, record06600);
    expect(r.errors[0]).toMatch(/Indica la alcaldía o municipio \(Cuauhtémoc\)/);
  });

  it("only warns about a colonia outside the C.P. list", () => {
    const r = checkAddressAgainstCatalog({ ...complete, neighborhood: "Fracc. Nuevo" }, record06600);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
});
