import { describe, expect, it } from "vitest";
import { isProfileComplete } from "./progress";
import { getTourSteps, tourForPath } from "./tours";
import { EMPTY_ONBOARDING, isOnboardingRole, parseOnboarding } from "./types";

describe("parseOnboarding", () => {
  it("devuelve un estado vacío ante basura o versiones viejas", () => {
    expect(parseOnboarding(null)).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding("x")).toEqual(EMPTY_ONBOARDING);
    expect(parseOnboarding({ v: 0, welcomeSeen: true })).toEqual(EMPTY_ONBOARDING);
  });

  it("conserva solo los campos válidos", () => {
    const parsed = parseOnboarding({
      v: 1,
      welcomeSeen: true,
      tours: { dashboard: "2026-09-15T00:00:00Z", bogus: 42 },
      checklistDismissedAt: 7,
    });
    expect(parsed).toEqual({
      v: 1,
      welcomeSeen: true,
      tours: { dashboard: "2026-09-15T00:00:00Z" },
      checklistDismissedAt: null,
    });
  });
});

describe("isOnboardingRole", () => {
  it("solo aplica a quienes publican propiedades", () => {
    expect(isOnboardingRole("VENDEDOR")).toBe(true);
    expect(isOnboardingRole("BROKER")).toBe(true);
    expect(isOnboardingRole("INMOBILIARIA")).toBe(true);
    expect(isOnboardingRole("COMPRADOR")).toBe(false);
    expect(isOnboardingRole("ADMIN")).toBe(false);
    expect(isOnboardingRole(undefined)).toBe(false);
  });
});

describe("isProfileComplete", () => {
  it("exige nombre, apellido y teléfono con contenido en profiles", () => {
    expect(isProfileComplete({ first_name: "Ana", last_name: "Torres", phone: "5544990759" })).toBe(true);
    // Caso real: la página de perfil mostraba un teléfono de ejemplo pero
    // profiles.phone seguía en null.
    expect(isProfileComplete({ first_name: "Vendedor", last_name: "QA", phone: null })).toBe(false);
    expect(isProfileComplete({ first_name: "Ana", last_name: "  ", phone: "55" })).toBe(false);
    expect(isProfileComplete({ first_name: "", last_name: "Torres", phone: "55" })).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });
});

describe("tourForPath", () => {
  it("mapea las tres pantallas del flujo y nada más", () => {
    expect(tourForPath("/dashboard")).toBe("dashboard");
    expect(tourForPath("/dashboard/propiedades/nueva")).toBe("nueva-propiedad");
    expect(tourForPath("/dashboard/propiedades/abc-123/solicitar-brc")).toBe("solicitar-brc");
    expect(tourForPath("/dashboard/propiedades")).toBeNull();
    expect(tourForPath("/dashboard/propiedades/abc/editar")).toBeNull();
  });
});

describe("getTourSteps", () => {
  it("adapta el recorrido del panel al rol", () => {
    const vendedor = getTourSteps("dashboard", "VENDEDOR").map((s) => s.target);
    const broker = getTourSteps("dashboard", "BROKER").map((s) => s.target);
    // Sin paso de identidad (KYC): el recorrido va directo a lo que vende.
    expect(vendedor).not.toContain("nav:/dashboard/documentos");
    expect(vendedor).toContain("nav:/dashboard/expedientes");
    expect(vendedor).not.toContain("nav:/dashboard/leads");
    expect(vendedor).not.toContain("nav:/dashboard/membresia");
    expect(broker).toContain("nav:/dashboard/leads");
    expect(broker).toContain("nav:/dashboard/membresia");
  });

  it("empieza con una introducción y termina con el CTA a publicar", () => {
    const steps = getTourSteps("dashboard", "VENDEDOR");
    expect(steps[0]?.target).toBeUndefined();
    expect(steps.at(-1)?.ctaHref).toBe("/dashboard/propiedades/nueva");
  });
});
