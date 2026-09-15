import { describe, expect, it } from "vitest";
import { EXPEDIENTES_NUEVA_SOLICITUD_EVENT, getTourSteps, tourForPath } from "./tours";

describe("recorrido de expedientes", () => {
  it("se asigna a la ruta de expedientes", () => {
    expect(tourForPath("/dashboard/expedientes")).toBe("expedientes");
    expect(tourForPath("/dashboard/expedientes/abc-123")).toBeNull();
  });

  it("sin propiedades manda a publicar antes de certificar", () => {
    const steps = getTourSteps("expedientes", "VENDEDOR", { hasProperties: false });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0]?.target).toBeUndefined();
    expect(steps.map((s) => s.target)).toContain("exp:vacio-cta");

    const last = steps.at(-1)!;
    expect(last.target).toBeUndefined();
    expect(last.ctaHref).toBe("/dashboard/propiedades/nueva");
    expect(last.ctaLabel).toBe("Publicar mi primera propiedad");
    expect(last.nextLabel).toBe("Después");
    expect(last.ctaEvent).toBeUndefined();
  });

  it("con propiedades explica el flujo y cierra abriendo el modal por evento", () => {
    const steps = getTourSteps("expedientes", "VENDEDOR", { hasProperties: true });
    const targets = steps.map((s) => s.target);
    expect(steps[0]?.target).toBeUndefined();
    expect(targets).toEqual(
      expect.arrayContaining(["exp:resumen", "exp:nueva", "exp:lista"]),
    );
    expect(targets).not.toContain("exp:vacio-cta");

    const last = steps.at(-1)!;
    expect(last.target).toBeUndefined();
    expect(last.ctaHref).toBeUndefined();
    expect(last.ctaEvent).toBe(EXPEDIENTES_NUEVA_SOLICITUD_EVENT);
    expect(last.ctaLabel).toBeTruthy();
    expect(last.nextLabel).toBe("Después");
  });

  it("el recorrido no depende del rol", () => {
    for (const hasProperties of [true, false]) {
      const a = getTourSteps("expedientes", "VENDEDOR", { hasProperties });
      const b = getTourSteps("expedientes", "INMOBILIARIA", { hasProperties });
      expect(a).toEqual(b);
    }
  });

  it("por defecto asume que hay propiedades", () => {
    expect(getTourSteps("expedientes", "BROKER")).toEqual(
      getTourSteps("expedientes", "BROKER", { hasProperties: true }),
    );
  });
});
