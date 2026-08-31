import { describe, it, expect } from "vitest";
import {
  SELF_ASSIGNABLE_ROLES,
  PRIVILEGED_ROLES,
  resolveSignupRole,
  isPrivilegedRole,
  isRoleApplication,
  DEFAULT_SIGNUP_ROLE,
} from "./auth-roles";

describe("signup role resolution (BH-01)", () => {
  it("never emits a privileged role from a browser selection", () => {
    for (const role of PRIVILEGED_ROLES) {
      expect(resolveSignupRole(role)).toBe(DEFAULT_SIGNUP_ROLE);
      expect(resolveSignupRole(role.toLowerCase())).toBe(DEFAULT_SIGNUP_ROLE);
    }
    // The exact string the old form sent for the "Notario" card.
    expect(resolveSignupRole("notario")).toBe(DEFAULT_SIGNUP_ROLE);
    expect(resolveSignupRole("NOTARIO")).toBe(DEFAULT_SIGNUP_ROLE);
  });

  it("keeps every legitimate self-service role working", () => {
    for (const role of SELF_ASSIGNABLE_ROLES) {
      expect(resolveSignupRole(role.toLowerCase())).toBe(role);
    }
  });

  it("collapses unknown, empty or malformed input to the default role", () => {
    for (const value of [undefined, null, "", "  ", 7, {}, ["ADMIN"], "SUPERADMIN"]) {
      expect(resolveSignupRole(value)).toBe(DEFAULT_SIGNUP_ROLE);
    }
  });

  it("classifies a privileged pick as an application, not a grant", () => {
    expect(isRoleApplication("NOTARIO")).toBe(true);
    expect(isRoleApplication("notario")).toBe(true);
    expect(isRoleApplication("COMPRADOR")).toBe(false);
  });

  it("keeps the two role sets disjoint", () => {
    for (const role of SELF_ASSIGNABLE_ROLES) expect(isPrivilegedRole(role)).toBe(false);
    for (const role of PRIVILEGED_ROLES) expect(isPrivilegedRole(role)).toBe(true);
  });
});
