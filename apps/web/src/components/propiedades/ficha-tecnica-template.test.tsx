import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  FichaTecnicaTemplate,
  type FichaProperty,
} from "./ficha-tecnica-template";

/**
 * QA de integración — costura G.
 *
 * TRASPASO dejó de ser una operación y se convirtió en el atributo
 * `applies_traspaso` de un local comercial (migración 027). El atributo se
 * captura y se guarda, y la ficha pública lo pinta porque recorre
 * `getVisibleFields(type)` — pero la ficha técnica en PDF construye su lista de
 * specs a mano y se había quedado sin las tres filas tri-estado de la matriz.
 * Un comprador que descarga la ficha de un local no veía el dato que sustituyó
 * a la operación entera.
 */

const BASE: FichaProperty = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Local en Polanco",
  description: "Local a pie de calle.",
  type: "LOCAL_COMERCIAL",
  operation: "VENTA",
  price: 4_000_000,
  currency: "MXN",
  accepts_crypto: false,
  area_total: 120,
  area_built: 100,
  bedrooms: null,
  bathrooms: 1,
  parking_spaces: 2,
  floors: 1,
  address_line: "Av. Presidente Masaryk 100",
  neighborhood: "Polanco",
  city: "Ciudad de México",
  state: "Ciudad de México",
  zip_code: "11560",
  amenities: [],
  featured_image_url: null,
  brc_status: "NO_SOLICITADO",
};

function renderFicha(overrides: Partial<FichaProperty>) {
  return render(
    <FichaTecnicaTemplate
      property={{ ...BASE, ...overrides }}
      media={[]}
      qrDataUrl={null}
      publicUrl="https://bithauss.com/propiedades/1"
      generatedAt={new Date("2026-08-31T12:00:00Z")}
    />,
  );
}

describe("ficha técnica · fila «¿Aplica traspaso?» (costura G)", () => {
  it("imprime «Sí» cuando el local aplica traspaso", () => {
    renderFicha({ applies_traspaso: true });
    expect(screen.getByText("¿Aplica traspaso?")).toBeInTheDocument();
  });

  it("imprime «No» cuando el publicador respondió que no", () => {
    renderFicha({ applies_traspaso: false });
    expect(screen.getByText("¿Aplica traspaso?")).toBeInTheDocument();
  });

  it("null es «sin responder»: la fila no aparece, no se responde por el dueño", () => {
    renderFicha({ applies_traspaso: null });
    expect(screen.queryByText("¿Aplica traspaso?")).not.toBeInTheDocument();
  });

  it("no aparece en tipos donde la matriz no la contempla", () => {
    // La matriz sólo muestra "¿Aplica traspaso?" en LOCAL_COMERCIAL. Un valor
    // heredado en una casa no debe imprimirse.
    renderFicha({ type: "CASA", applies_traspaso: true });
    expect(screen.queryByText("¿Aplica traspaso?")).not.toBeInTheDocument();
  });

  it("las otras dos filas tri-estado de la matriz también se imprimen", () => {
    renderFicha({ type: "CASA", is_furnished: true, has_terrace: false });
    expect(screen.getByText("Amueblado")).toBeInTheDocument();
    expect(screen.getByText("Terraza")).toBeInTheDocument();
  });
});
