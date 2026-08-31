import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { MembershipHolding, UsageSnapshot } from "@/lib/membership";

import { MembresiaView } from "./membresia-view";

const NOW = new Date("2026-03-01T12:00:00.000Z");

function iso(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

function holding(
  overrides: Partial<MembershipHolding> & { tier: MembershipHolding["tier"] },
): MembershipHolding {
  return {
    id: `sub-${overrides.tier}`,
    period: "ANUAL",
    status: "ACTIVA",
    currentPeriodEnd: iso(200),
    trialEndsAt: null,
    parentSubscriptionId: null,
    paymentConfirmedBy: "admin-1",
    ...overrides,
  };
}

const NO_USAGE: UsageSnapshot = {
  publishedProperties: 0,
  crmSeatsUsed: 0,
  legalTicketsUsed: 0,
};

describe("<MembresiaView />", () => {
  it("muestra la membresía, la vigencia y los días restantes", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "GOLD", period: "SEMESTRAL" })]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );

    expect(screen.getByText(/Membresía 4 GOLD/)).toBeInTheDocument();
    expect(screen.getByText(/Plan Semestral/)).toBeInTheDocument();
    expect(screen.getByText(/200 días restantes/)).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
  });

  it("muestra el consumo real contra el límite del plan", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "GOLD" })]}
        usage={{
          publishedProperties: 24,
          crmSeatsUsed: 3,
          legalTicketsUsed: 0,
        }}
        now={NOW}
      />,
    );

    const properties = screen.getByTestId("usage-properties");
    expect(within(properties).getByText("24")).toBeInTheDocument();
    expect(within(properties).getByText("/300")).toBeInTheDocument();

    const crm = screen.getByTestId("usage-crm");
    expect(within(crm).getByText("3")).toBeInTheDocument();
    expect(within(crm).getByText("/4")).toBeInTheDocument();
  });

  it("suma las membresías acumuladas de PLATINO (800 + 500 = 1,300)", () => {
    render(
      <MembresiaView
        holdings={[
          holding({ tier: "PLATINO", id: "p" }),
          holding({ tier: "BLACK", id: "c", parentSubscriptionId: "p" }),
        ]}
        usage={{ publishedProperties: 900, crmSeatsUsed: 7, legalTicketsUsed: 0 }}
        now={NOW}
      />,
    );

    const properties = screen.getByTestId("usage-properties");
    expect(within(properties).getByText("/1,300")).toBeInTheDocument();
    expect(screen.getByText(/Membresías acumuladas/)).toBeInTheDocument();
    expect(screen.getByText(/5 BLACK/)).toBeInTheDocument();
  });

  it("muestra el banner de prueba con los días restantes y los límites reducidos", () => {
    render(
      <MembresiaView
        holdings={[
          holding({
            tier: "PLATINO",
            status: "PRUEBA",
            trialEndsAt: iso(4),
            paymentConfirmedBy: null,
          }),
        ]}
        usage={{ publishedProperties: 1, crmSeatsUsed: 1, legalTicketsUsed: 0 }}
        now={NOW}
      />,
    );

    expect(
      screen.getByText(/Estás en tu periodo de prueba: te quedan 4 días de 7/),
    ).toBeInTheDocument();
    // A PLATINO trial still only grants the trial allowance.
    expect(
      within(screen.getByTestId("usage-properties")).getByText("/3"),
    ).toBeInTheDocument();
  });

  it("avisa la renovación próxima", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "BLUE", currentPeriodEnd: iso(12) })]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );
    expect(
      screen.getByText(/Tu membresía vence en 12 días/),
    ).toBeInTheDocument();
  });

  it("explica que el pago está en doble verificación", () => {
    render(
      <MembresiaView
        holdings={[
          holding({
            tier: "BLUE",
            status: "PENDIENTE_PAGO",
            paymentConfirmedBy: null,
          }),
        ]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );

    expect(screen.getByText(/Tu pago está en verificación/)).toBeInTheDocument();
    expect(screen.getAllByText(/doble verificación/).length).toBeGreaterThan(0);
    // Nothing is granted while the payment is unconfirmed.
    expect(
      within(screen.getByTestId("usage-properties")).getByText("/0"),
    ).toBeInTheDocument();
  });

  it("bloquea el downgrade y sólo ofrece niveles superiores", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "BLUE" })]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("upgrade-GOLD")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-BLACK")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-PLATINO")).toBeInTheDocument();
    // Lower tiers are never offered as a destination.
    expect(screen.queryByTestId("upgrade-START")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upgrade-GROW")).not.toBeInTheDocument();

    expect(
      screen.getByText(/No es posible bajar de nivel de membresía/),
    ).toBeInTheDocument();
    expect(screen.getByText(/cancelar el contrato vigente/)).toBeInTheDocument();
  });

  it("en PLATINO no ofrece upgrade e invita a acumular", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "PLATINO" })]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId("upgrade-BLACK")).not.toBeInTheDocument();
    expect(
      screen.getByText(/membresías adicionales para acumular/),
    ).toBeInTheDocument();
  });

  it("muestra los descuentos vigentes del nivel", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "BLACK" })]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );

    expect(
      within(screen.getByTestId("discount-brc")).getByText("10%"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("discount-video")).getByText("10%"),
    ).toBeInTheDocument();
    // The video discount is still in development.
    expect(
      within(screen.getByTestId("discount-video")).getByText(/Próximamente/i),
    ).toBeInTheDocument();
  });

  it("los tickets jurídicos sólo existen con el Plan Anual anticipado", () => {
    const { unmount } = render(
      <MembresiaView
        holdings={[holding({ tier: "BLACK", period: "ANUAL" })]}
        usage={NO_USAGE}
        now={NOW}
      />,
    );
    expect(
      within(screen.getByTestId("usage-tickets")).getByText(/Aplican sólo en/),
    ).toBeInTheDocument();
    unmount();

    render(
      <MembresiaView
        holdings={[holding({ tier: "BLACK", period: "ANUAL_ANTICIPADO" })]}
        usage={{ publishedProperties: 0, crmSeatsUsed: 0, legalTicketsUsed: 1 }}
        now={NOW}
      />,
    );
    const tickets = screen.getByTestId("usage-tickets");
    expect(within(tickets).getByText("/3")).toBeInTheDocument();
    expect(within(tickets).getByText(/Te quedan 2/)).toBeInTheDocument();
  });

  it("alerta cuando se agotó el cupo de propiedades", () => {
    render(
      <MembresiaView
        holdings={[holding({ tier: "START" })]}
        usage={{ publishedProperties: 50, crmSeatsUsed: 1, legalTicketsUsed: 0 }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Alcanzaste el límite de 50 propiedades/,
    );
  });

  it("sin membresía muestra el estado vacío", () => {
    render(<MembresiaView holdings={[]} usage={NO_USAGE} now={NOW} />);
    expect(
      screen.getByText(/Aún no tienes una membresía activa/),
    ).toBeInTheDocument();
  });
});
