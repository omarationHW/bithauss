import { describe, expect, it } from "vitest";

import {
  buildPropertyShareMetadata,
  buildShareDescription,
  resolveBaseUrl,
  type SharePropertyRow,
} from "./property-share-metadata";

const BASE: SharePropertyRow = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "casa-polanco",
  title: "Casa en Polanco con jardín",
  type: "CASA",
  operation: "VENTA",
  status: "PUBLICADO",
  price: 4_500_000,
  price_sale: 4_500_000,
  price_rent: null,
  currency: "MXN",
  show_price: true,
  area_total: 300,
  area_built: 180,
  bedrooms: 3,
  bathrooms: 2,
  parking_spaces: null,
  neighborhood: "Polanco",
  city: "Ciudad de México",
  state: "Ciudad de México",
  featured_image_url: "https://abc.supabase.co/storage/v1/object/public/properties/u/p/wm/k-0abc123-wm.jpg",
};

describe("vista previa del enlace (Open Graph)", () => {
  it("describe operación, precio, specs y colonia/ciudad", () => {
    const d = buildShareDescription(BASE);
    expect(d).toContain("En venta");
    expect(d).toContain("Casa");
    expect(d).toMatch(/\$4,500,000 MXN/);
    expect(d).toContain("3 recámaras");
    expect(d).toContain("2 baños");
    expect(d).toContain("180 m²");
    expect(d).toContain("Polanco, Ciudad de México");
  });

  it("en dólares escribe la moneda una sola vez", () => {
    const d = buildShareDescription({ ...BASE, currency: "USD", price: 7_000_000, price_sale: 7_000_000 });
    expect(d).toMatch(/\$7,000,000 USD/);
    expect(d).not.toMatch(/USD.*USD/);
  });

  it("nunca filtra un precio oculto", () => {
    const d = buildShareDescription({ ...BASE, show_price: false });
    expect(d).toContain("Precio a consultar");
    expect(d).not.toMatch(/4,500,000/);
  });

  it("og:image apunta a la ruta propia (foto limpia y redimensionada), no a la foto estampada", () => {
    const m = buildPropertyShareMetadata(BASE, "https://bithauss-web.azurewebsites.net");
    const og = m.openGraph as { images: { url: string; width: number; height: number }[]; url: string; type: string };
    expect(og.images[0]!.url).toBe(
      `https://bithauss-web.azurewebsites.net/api/og/propiedad/${BASE.id}`,
    );
    expect(og.images[0]).toMatchObject({ width: 1200, height: 630 });
    expect(og.url).toBe("https://bithauss-web.azurewebsites.net/propiedades/casa-polanco");
    expect(og.type).toBe("website");
    expect(JSON.stringify(m)).not.toContain("-wm.jpg");
  });

  it("toma el origen público de las cabeceras del proxy", () => {
    const h = new Headers({
      host: "internal:8080",
      "x-forwarded-host": "bithauss-web.azurewebsites.net",
      "x-forwarded-proto": "https",
    });
    expect(resolveBaseUrl(h)).toBe("https://bithauss-web.azurewebsites.net");
    expect(resolveBaseUrl(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });
});
