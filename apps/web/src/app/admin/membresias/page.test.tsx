import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminMembresiasPage from "./page";

/**
 * A5 — the double verification is the point of this screen, so the tests are
 * about who may do what, not about how the table looks.
 *
 * Fixtures: "Ana Ruiz" is the signed-in admin.
 *   sub-3 (Carlos Mendoza)  — payment recorded by Ana  → she may NOT confirm.
 *   sub-4 (Sofía Morales)   — payment recorded by Luis → she MAY confirm.
 *   sub-6 (Luis Castillo)   — cancellation asked by Luis → she MAY authorise.
 */

describe("<AdminMembresiasPage />", () => {
  it("abre en la cola de pagos por verificar", () => {
    render(<AdminMembresiasPage />);
    expect(screen.getByRole("tab", { name: /Pagos por verificar/i })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByTestId("row-sub-3")).toBeInTheDocument();
    expect(screen.getByTestId("row-sub-4")).toBeInTheDocument();
  });

  it("impide que quien registró el pago sea quien lo confirma", async () => {
    const user = userEvent.setup();
    render(<AdminMembresiasPage />);

    const row = screen.getByTestId("row-sub-3"); // registrado por Ana Ruiz
    await user.click(within(row).getByRole("button", { name: /Confirmar pago/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /tú lo registraste.*segundo administrador/i,
    );
    // La suscripción sigue pendiente: una sola persona no activa nada.
    expect(within(screen.getByTestId("row-sub-3")).getByText("Pago por verificar"))
      .toBeInTheDocument();
  });

  it("un segundo administrador sí activa la membresía y queda registrado", async () => {
    const user = userEvent.setup();
    render(<AdminMembresiasPage />);

    const row = screen.getByTestId("row-sub-4"); // registrado por Luis Prado
    await user.click(within(row).getByRole("button", { name: /Confirmar pago/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /confirmado por Ana Ruiz/i,
    );

    await user.click(screen.getByRole("tab", { name: /Activas/i }));
    const activated = screen.getByTestId("row-sub-4");
    expect(within(activated).getByText("Activa")).toBeInTheDocument();
    expect(activated.textContent).toMatch(/Confirmó:\s*Ana Ruiz/);
  });

  it("muestra quién registró y quién confirmó cada pago", () => {
    render(<AdminMembresiasPage />);
    const row = screen.getByTestId("row-sub-3");
    expect(row.textContent).toMatch(/Registró:\s*Ana Ruiz/);
    expect(row.textContent).toMatch(/Confirmó:\s*Pendiente/);
  });

  it("la cancelación por falta de pago requiere un segundo administrador", async () => {
    const user = userEvent.setup();
    render(<AdminMembresiasPage />);

    await user.click(screen.getByRole("tab", { name: /Cancelaciones/i }));
    const row = screen.getByTestId("row-sub-6"); // solicitada por Luis Prado
    expect(row.textContent).toMatch(/Cancelación solicitada por Luis Prado/);

    await user.click(
      within(row).getByRole("button", { name: /Autorizar cancelación/i }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /cancelada por Ana Ruiz/i,
    );
  });

  it("solicitar una cancelación suspende, no cancela, y pide segunda firma", async () => {
    const user = userEvent.setup();
    render(<AdminMembresiasPage />);

    await user.click(screen.getByRole("tab", { name: /Activas/i }));
    const row = screen.getByTestId("row-sub-1");
    await user.click(
      within(row).getByRole("button", { name: /Solicitar cancelación/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /Requiere autorización de otro administrador/i,
    );

    // Y el mismo admin no puede autorizarla.
    await user.click(screen.getByRole("tab", { name: /Cancelaciones/i }));
    const pending = screen.getByTestId("row-sub-1");
    await user.click(
      within(pending).getByRole("button", { name: /Autorizar cancelación/i }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /tú la solicitaste/i,
    );
  });

  it("marca las membresías acumuladas sobre PLATINO", async () => {
    const user = userEvent.setup();
    render(<AdminMembresiasPage />);
    await user.click(screen.getByRole("tab", { name: /Todas/i }));
    expect(within(screen.getByTestId("row-sub-2")).getByText("Acumulada"))
      .toBeInTheDocument();
  });

  it("publica el catálogo completo con precios más IVA", () => {
    render(<AdminMembresiasPage />);
    expect(screen.getByText(/6 niveles × 4 planes = 24 combinaciones/)).toBeInTheDocument();
    expect(screen.getAllByText("$70,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$3,000").length).toBeGreaterThan(0);
  });
});
