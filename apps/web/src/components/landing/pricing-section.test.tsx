import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PricingSection } from "./pricing-section";

/** The 24 published prices, keyed the way the section renders them. */
const PRICES = {
  TRIMESTRAL: {
    START: "$3,000",
    GROW: "$4,500",
    BLUE: "$7,500",
    GOLD: "$10,000",
    BLACK: "$15,000",
    PLATINO: "$20,000",
  },
  SEMESTRAL: {
    START: "$6,000",
    GROW: "$9,000",
    BLUE: "$15,000",
    GOLD: "$20,000",
    BLACK: "$30,000",
    PLATINO: "$40,000",
  },
  ANUAL: {
    START: "$12,000",
    GROW: "$18,000",
    BLUE: "$30,000",
    GOLD: "$40,000",
    BLACK: "$60,000",
    PLATINO: "$80,000",
  },
  ANUAL_ANTICIPADO: {
    START: "$10,000",
    GROW: "$15,000",
    BLUE: "$25,000",
    GOLD: "$35,000",
    BLACK: "$50,000",
    PLATINO: "$70,000",
  },
} as const;

function expectPrices(period: keyof typeof PRICES) {
  for (const [tier, price] of Object.entries(PRICES[period])) {
    expect(screen.getByTestId(`price-${tier}`)).toHaveTextContent(price);
    expect(screen.getByTestId(`table-price-${tier}`)).toHaveTextContent(price);
  }
}

describe("<PricingSection />", () => {
  it("muestra los seis niveles reales de membresía", () => {
    render(<PricingSection />);
    for (const name of [
      "1 START",
      "2 GROW",
      "3 BLUE",
      "4 GOLD",
      "5 BLACK",
      "6 PLATINO",
    ]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("arranca en Plan Anual con los seis precios anuales", () => {
    render(<PricingSection />);
    expectPrices("ANUAL");
  });

  it("cambiar de periodo actualiza los seis precios", async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    await user.click(screen.getByRole("radio", { name: "Trimestral" }));
    expectPrices("TRIMESTRAL");

    await user.click(screen.getByRole("radio", { name: "Semestral" }));
    expectPrices("SEMESTRAL");

    await user.click(
      screen.getByRole("radio", { name: /Anual · pago anticipado/i }),
    );
    expectPrices("ANUAL_ANTICIPADO");

    await user.click(screen.getByRole("radio", { name: "Anual" }));
    expectPrices("ANUAL");
  });

  it("marca el periodo seleccionado de forma accesible", async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    const trimestral = screen.getByRole("radio", { name: "Trimestral" });
    expect(trimestral).toHaveAttribute("aria-checked", "false");

    await user.click(trimestral);
    expect(trimestral).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Anual" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("destaca el ahorro del plan anual pagado por anticipado", async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    await user.click(
      screen.getByRole("radio", { name: /Anual · pago anticipado/i }),
    );

    // PLATINO: 80,000 − 70,000 = 10,000 (12 %).
    // One savings line per tier card.
    expect(screen.getAllByText(/Ahorras/i)).toHaveLength(6);
    expect(screen.getAllByText(/\$10,000/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/una sola exhibición al contratar/i),
    ).toBeInTheDocument();
  });

  it("muestra las mensualidades domiciliadas de los planes con cargo mensual", async () => {
    const user = userEvent.setup();
    render(<PricingSection />);

    await user.click(screen.getByRole("radio", { name: "Trimestral" }));
    // START: 3 pagos de $1,100.
    expect(
      screen.getAllByText(/3 pagos mensuales domiciliados de/i),
    ).toHaveLength(6);
    expect(screen.getAllByText(/\$1,100/).length).toBeGreaterThan(0);
  });

  it("aclara que los precios son más IVA", () => {
    render(<PricingSection />);
    expect(screen.getAllByText(/IVA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MXN \+ IVA/).length).toBe(6);
  });

  it("marca como próximamente los beneficios en desarrollo", () => {
    render(<PricingSection />);

    const table = screen.getByRole("region", {
      name: /tabla comparativa de membresías/i,
    });
    const rows = within(table).getAllByRole("row");

    const videoRow = rows.find((r) =>
      r.textContent?.includes("Descuento videos de propiedades"),
    );
    expect(videoRow?.textContent).toMatch(/Próximamente/i);

    // The BRC discount is live, so it must NOT be flagged.
    const brcRow = rows.find((r) =>
      r.textContent?.includes("Descuento emisión de certificados BRC"),
    );
    expect(brcRow?.textContent).not.toMatch(/Próximamente/i);
  });

  it("la tabla comparativa tiene su propia región desplazable", () => {
    render(<PricingSection />);
    const region = screen.getByRole("region", {
      name: /tabla comparativa de membresías/i,
    });
    expect(region.className).toContain("overflow-x-auto");
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("lista propiedades y cuentas CRM por nivel en la comparativa", () => {
    render(<PricingSection />);
    const table = screen.getByRole("region", {
      name: /tabla comparativa de membresías/i,
    });
    const rows = within(table).getAllByRole("row");

    const propsRow = rows.find((r) =>
      r.textContent?.startsWith("Propiedades a publicar"),
    );
    expect(propsRow?.textContent).toContain("50");
    expect(propsRow?.textContent).toContain("800");
  });
});
