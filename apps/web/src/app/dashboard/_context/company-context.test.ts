import { describe, expect, it, vi } from "vitest";
vi.mock("./user-context", () => ({ useUser: () => ({ user: null }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
import { propertyScope } from "./company-context";

const a = { id: "a" };
const b = { id: "b" };

describe("propertyScope", () => {
  it("limita a la inmobiliaria elegida", () => {
    expect(propertyScope("u", false, [a, b], b)).toBe("company_id.eq.b");
  });
  it("sin elegir, suma las propias y las de sus inmobiliarias", () => {
    expect(propertyScope("u", false, [a, b], null)).toBe("owner_id.eq.u,company_id.in.(a,b)");
  });
  it("sin inmobiliarias o siendo ADMIN, sólo las propias", () => {
    expect(propertyScope("u", false, [], null)).toBe("owner_id.eq.u");
    expect(propertyScope("u", true, [a], null)).toBe("owner_id.eq.u");
  });
});
