import { describe, expect, it } from "vitest";
import { isAssistantRoute } from "./constants";

describe("isAssistantRoute", () => {
  it.each(["/", "/propiedades", "/propiedades/abc-123", "/como-funciona", "/nosotros", "/certificado/xyz"])(
    "shows on public page %s",
    (path) => expect(isAssistantRoute(path)).toBe(true),
  );
  it.each(["/dashboard", "/dashboard/propiedades", "/admin", "/admin/brc", "/auth/login", "/propiedadesx", "/api/foto", "", null])(
    "stays off %s",
    (path) => expect(isAssistantRoute(path)).toBe(false),
  );
});
