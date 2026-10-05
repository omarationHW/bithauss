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

/**
 * La ficha circula fuera de la plataforma: otro corredor la manda a su
 * cliente. Si lleva el logo o los datos de la inmobiliaria, el cliente se
 * salta al corredor. Sólo puede quedar la marca BitHauss.
 */
const SUPA = "https://abc.supabase.co/storage/v1/object/public/properties";
const UID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PID = BASE.id;
const WM_COVER = `${SUPA}/${UID}/${PID}/wm/key-cover-0abc123-wm.jpg?v=0abc123`;
const CLEAN_COVER = `${SUPA}/${UID}/${PID}/originals/key-cover.orig`;
const WM_PHOTO = `${SUPA}/${UID}/${PID}/wm/key-sala-0abc123-wm.jpg?v=0abc123`;
const CLEAN_PHOTO = `${SUPA}/${UID}/${PID}/originals/key-sala.orig`;

function renderWithPhotos(
  options?: Parameters<typeof FichaTecnicaTemplate>[0]["options"],
) {
  // Campos que existen en la fila de BD / el perfil del dueño y que nunca
  // deben llegar a la ficha aunque alguien los pase de más.
  const leaky = {
    ...BASE,
    featured_image_url: WM_COVER,
    owner_name: "Tanner Real Estate",
    company_name: "Tanner Real Estate",
    agent_phone: "55 1234 5678",
    agent_email: "ventas@tanner.mx",
    website: "https://tanner.mx",
  } as FichaProperty;
  return render(
    <FichaTecnicaTemplate
      property={leaky}
      media={[
        { id: "m1", url: WM_COVER, alt_text: null },
        { id: "m2", url: WM_PHOTO, alt_text: null },
      ]}
      qrDataUrl="data:image/png;base64,AAAA"
      publicUrl="https://bithauss.com/propiedades/1"
      generatedAt={new Date("2026-08-31T12:00:00Z")}
      options={options}
    />,
  );
}

const LAYOUTS = [
  { layout: "full", orientation: "portrait", includeAllPhotos: true },
  { layout: "full", orientation: "landscape", includeAllPhotos: true },
  { layout: "single", orientation: "portrait", includeAllPhotos: true },
  { layout: "single", orientation: "landscape", includeAllPhotos: true },
] as const;

describe.each(LAYOUTS)("ficha técnica · sin datos de la inmobiliaria ($layout/$orientation)", (opts) => {
  it("no imprime nombre, teléfono, correo ni sitio de la inmobiliaria", () => {
    const { container } = renderWithPhotos(opts);
    const html = container.innerHTML;
    expect(html).not.toMatch(/tanner/i);
    expect(html).not.toContain("55 1234 5678");
    expect(html).not.toContain("ventas@");
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  });

  it("el único logo es el de BitHauss", () => {
    const { container } = renderWithPhotos(opts);
    const logos = Array.from(container.querySelectorAll("img")).filter(
      (img) => !img.getAttribute("src")?.startsWith("data:"),
    );
    expect(logos.length).toBeGreaterThan(0);
    for (const img of logos) {
      expect(img).toHaveAttribute("alt", "BitHauss");
      expect(img.getAttribute("src")).toMatch(/\/images\/Logo-BitHauss\.png$/);
    }
  });

  it("usa el original archivado, nunca la foto con la marca de agua horneada", () => {
    const { container } = renderWithPhotos(opts);
    expect(container.innerHTML).not.toContain("-wm.jpg");
    const sources = Array.from(container.querySelectorAll("[data-cover-src]")).map(
      (el) => el.getAttribute("data-cover-src"),
    );
    expect(sources).toContain(CLEAN_COVER);
    expect(sources).toContain(CLEAN_PHOTO);
  });

  it("la foto principal es cuadrada y recortada (cover), nunca estirada", () => {
    const { container } = renderWithPhotos(opts);
    // El contenedor fuera de pantalla es aria-hidden: se busca por atributo.
    const hero = container.querySelector<HTMLElement>(`[role="img"][aria-label="${BASE.title}"]`)!;
    expect(hero.getAttribute("data-cover-src")).toBe(CLEAN_COVER);
    expect(hero.style.width).toBe(hero.style.height);
    expect(hero.style.width).toMatch(/^\d+px$/);
    expect(hero.style.backgroundSize).toBe("cover");
    expect(hero.style.backgroundPosition).toMatch(/^center( center)?$/);
  });
});

describe("ficha técnica · disposición de la portada", () => {
  it("la foto va a la DERECHA de los datos (después del título en el DOM)", () => {
    const { container } = renderWithPhotos();
    const page1 = container.querySelector('[data-page="1"]')!;
    const title = page1.querySelector("h1")!;
    const hero = page1.querySelector<HTMLElement>(`[role="img"][aria-label="${BASE.title}"]`)!;
    // Mismo renglón flex: el título está en la primera columna, la foto en la segunda.
    expect(title.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const row = hero.parentElement!;
    expect(row.style.display).toBe("flex");
    expect(row.contains(title)).toBe(true);
  });

  it("ninguna foto se pinta con <img object-fit> (html2canvas lo ignora y la estira)", () => {
    const { container } = renderWithPhotos();
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img.style.objectFit).toBe("");
    }
  });
});
