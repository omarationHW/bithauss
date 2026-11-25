import { describe, expect, it } from "vitest";
import { parseRepresentatives } from "./parse-representatives";

describe("parseRepresentatives", () => {
  it("separa por línea y limpia vacíos, espacios y repetidos", () => {
    expect(parseRepresentatives(" Guadalupe  Hernández \n\nRenato Torres\r\nRenato Torres\n")).toEqual([
      "Guadalupe Hernández",
      "Renato Torres",
    ]);
  });
  it("vacío da lista vacía", () => expect(parseRepresentatives(" \n ")).toEqual([]));
});
