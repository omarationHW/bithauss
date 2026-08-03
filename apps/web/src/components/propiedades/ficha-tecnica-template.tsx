"use client";

/* eslint-disable @next/next/no-img-element -- html2canvas captures raw <img>
   elements with an explicit crossOrigin="anonymous"; next/image would inject a
   proxied/lazy <img> that taints the canvas. */

/**
 * Off-screen printable layout used by the "Descargar ficha técnica" feature.
 *
 * Each direct child marked with `data-page` is captured by html2canvas as a
 * standalone PDF page. Dimensions match A4 at 96 DPI — 794x1123 px in portrait,
 * 1123x794 px in landscape — so the resulting PDF preserves the visual
 * proportions of the screen render.
 *
 * Two layouts, chosen by the user before downloading (see FichaOptionsDialog):
 *   - "full": cover + details + gallery pages (the original sheet).
 *   - "single": one page with the hero photo, key data, a trimmed description
 *     and a strip of thumbnails. It must never overflow, so every block is
 *     height-capped and the description is truncated.
 *
 * Intentionally excludes any broker / owner / company info — the sheet is
 * meant to circulate as a property fact sheet without revealing the agent.
 */

import { useMemo } from "react";
import {
  Ruler,
  BedDouble,
  Bath,
  Car,
  Building2,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { ShieldBrc } from "@/components/ui/shield-brc";
import {
  DEFAULT_FICHA_OPTIONS,
  type FichaOptions,
  type FichaOrientation,
} from "./ficha-options";

export interface FichaProperty {
  id: string;
  title: string;
  type: string;
  operation: string;
  description: string | null;
  price: number;
  price_sale?: number | null;
  price_rent?: number | null;
  currency: string;
  accepts_crypto: boolean;
  show_price?: boolean;
  area_total: number | null;
  area_built: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  half_bathrooms?: number | null;
  parking_spaces: number | null;
  floors: number | null;
  floor_number?: number | null;
  maintenance_fee?: number | null;
  has_service_room?: boolean;
  has_storage?: boolean;
  has_terrace?: boolean;
  has_laundry_room?: boolean;
  has_integrated_kitchen?: boolean;
  address_line: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  show_address?: boolean;
  amenities: string[];
  featured_image_url: string | null;
  brc_status: string;
}

export interface FichaMedia {
  id: string;
  url: string;
  alt_text: string | null;
}

export interface FichaTecnicaTemplateProps {
  property: FichaProperty;
  media: FichaMedia[];
  /** data URL for QR pointing to the property page (already rendered). */
  qrDataUrl: string | null;
  /** Public URL of the property (used as caption next to the QR). */
  publicUrl: string;
  generatedAt: Date;
  /** Orientation / layout / photo choices made in the download dialog. */
  options?: FichaOptions;
}

/** A4 at 96 DPI. */
const PAGE_SHORT_PX = 794;
const PAGE_LONG_PX = 1123;

function pageStyle(orientation: FichaOrientation): React.CSSProperties {
  const landscape = orientation === "landscape";
  return {
    width: `${landscape ? PAGE_LONG_PX : PAGE_SHORT_PX}px`,
    height: `${landscape ? PAGE_SHORT_PX : PAGE_LONG_PX}px`,
    background: "#ffffff",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    position: "relative",
    padding: landscape ? "36px 48px" : "48px 56px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
}

const ACCENT_GRADIENT =
  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))";

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#3b82f6",
  fontWeight: 700,
  margin: 0,
};

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function operationLabel(op: string): string {
  if (op === "VENTA") return "En venta";
  if (op === "RENTA") return "En renta";
  if (op === "VENTA_RENTA") return "Venta y renta";
  if (op === "TRASPASO") return "En traspaso";
  return op;
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    CASA: "Casa",
    CASA_CONDOMINIO: "Casa en condominio",
    DEPARTAMENTO: "Departamento",
    TERRENO: "Terreno",
    OFICINA: "Oficina",
    LOCAL_COMERCIAL: "Local comercial",
    BODEGA: "Bodega",
    HOTEL: "Hotel",
    DEPARTAMENTO_HOTEL: "Departamento en hotel",
    EDIFICIO: "Edificio",
    QUINTA: "Quinta",
  };
  return map[t] ?? t;
}

/**
 * Collapses whitespace and cuts on a word boundary. The single-page sheet has a
 * fixed budget for the description, so the text has to be trimmed before it can
 * push the thumbnails off the page.
 */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:]+$/, "")}…`;
}

/**
 * Height budget for the 1-page sheet (A4 @ 96 DPI, both orientations).
 *
 * IMPORTANT — why no text block is ever clipped here: html2canvas rasterises a
 * *clone* of the document, and the clone re-wraps text with slightly different
 * metrics (measured: a paragraph that takes 6 lines on screen came out as 7,
 * and glyphs sit a few px lower). Anything with `overflow: hidden` around text
 * — a pixel `maxHeight` *or* `-webkit-line-clamp` — therefore slices the last
 * line in half in the PDF even though it fits perfectly in the DOM. So text is
 * only ever bounded by character truncation (which ends with a visible "…"),
 * and the layout reserves room for the extra line the clone may add.
 *
 * Measured heights on a real listing (long title + long description):
 * portrait  1123 - 96 padding = 1027 usable; header 73 + footer 32 -> 922 body;
 *           minus 24 safety   = 898 available.
 *           hero 264 + title block 109 + price 54 + specs 56 +
 *           description 147 + gallery strip 118 + 5 gaps x 14 = 70   => 818,
 *           leaving ~80 px for the clone's re-wrapping (an extra title line is
 *           31 px, an extra description line 20 px, a wrapped price row 33 px).
 * landscape 794 - 72 padding = 722 usable; header 73 + footer 32 -> 617 body;
 *           minus 24 safety  = 593 available.
 *           left  hero 320 + gap 14 + gallery strip 238               => 572.
 *           right title 109 + price 54 + specs 112 + description 107 +
 *                 QR block 88 + 5 gaps x 12 = 60                      => 530,
 *           leaving ~63 px of the same re-wrapping headroom.
 */
const SINGLE_LAYOUT = {
  portrait: {
    heroHeight: 264,
    thumbCols: 4,
    thumbCount: 4,
    thumbHeight: 90,
    qrSize: 88,
    gap: 14,
    specCount: 4,
    titleChars: 100,
    addressChars: 84,
    descriptionChars: 500,
  },
  landscape: {
    heroHeight: 320,
    thumbCols: 3,
    thumbCount: 6,
    thumbHeight: 100,
    qrSize: 72,
    gap: 12,
    specCount: 6,
    titleChars: 78,
    addressChars: 70,
    descriptionChars: 340,
  },
} as const;

/** Free space kept between the content column and the page footer. */
const SINGLE_BOTTOM_SAFETY_PX = 24;

/**
 * Space available for the description on the "Detalles" page, in rendered
 * lines. Everything else on that page is fixed: address + datos block (~138 px),
 * QR card (140 px) and, when present, the amenities grid. Budget (body height
 * 922 px portrait / 617 px landscape, line 21.5 px at 13px/1.65) minus a ~20 %
 * margin for html2canvas re-wrapping the text a bit wider than the DOM.
 */
const DETAILS_TEXT = {
  portrait: {
    charsPerLine: 92,
    linesWithAmenities: 14,
    linesWithoutAmenities: 22,
    maxAmenities: 14,
  },
  landscape: {
    charsPerLine: 140,
    linesWithAmenities: 6,
    linesWithoutAmenities: 10,
    maxAmenities: 9,
  },
} as const;

/**
 * Trims text to a number of rendered lines. Honours the explicit line breaks
 * the details page keeps with `white-space: pre-wrap` and estimates wrapping
 * from an average characters-per-line figure.
 */
function truncateToLines(
  text: string,
  maxLines: number,
  charsPerLine: number,
): string {
  const source = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let used = 0;
  for (const raw of source) {
    const line = raw.trimEnd();
    const cost = Math.max(1, Math.ceil(line.length / charsPerLine));
    if (used + cost > maxLines) {
      const room = maxLines - used;
      if (room > 0 && line.length > 0) {
        out.push(truncate(line, room * charsPerLine));
        return out.join("\n");
      }
      // No room left (or the next line is blank): mark the last written line
      // instead of leaving a lone "…" hanging under an empty paragraph.
      while (out.length > 0 && out[out.length - 1]!.trim() === "") out.pop();
      if (out.length > 0) {
        const last = out[out.length - 1]!;
        out[out.length - 1] = `${last.replace(/[\s.,;:]+$/, "")}…`;
      }
      return out.join("\n");
    }
    out.push(line);
    used += cost;
  }
  return out.join("\n");
}

type SpecIcon = React.ComponentType<{ size?: number; color?: string }>;

interface Spec {
  key: string;
  icon: SpecIcon;
  label: string;
  value: string;
}

function PageHeader({ title }: { title: string }) {
  return (
    <header
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "16px",
        borderBottom: "1px solid #e2e8f0",
        marginBottom: "24px",
      }}
    >
      {/* Served from Azure Front Door — the local /public/images/ folder is
          gitignored, so /images/... 404s in production. */}
      <img
        src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-Texto-Negro.png"
        alt="BitHauss"
        crossOrigin="anonymous"
        style={{ height: "32px", width: "auto" }}
      />
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#64748b",
        }}
      >
        {title}
      </span>
    </header>
  );
}

function PageFooter({
  pageNum,
  totalPages,
  generatedAt,
}: {
  pageNum: number;
  totalPages: number;
  generatedAt: Date;
}) {
  return (
    <footer
      style={{
        flexShrink: 0,
        marginTop: "auto",
        paddingTop: "16px",
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        fontSize: "10px",
        color: "#94a3b8",
        letterSpacing: "0.04em",
      }}
    >
      <span>
        Generado el{" "}
        {generatedAt.toLocaleString("es-MX", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </span>
      <span>BitHauss · bithauss.com</span>
      <span>
        Página {pageNum} de {totalPages}
      </span>
    </footer>
  );
}

function StatTile({ icon: Icon, label, value }: Omit<Spec, "key">) {
  return (
    <div
      style={{
        // Basis instead of `1 1 0`: with six tiles a zero basis squeezed each
        // one to ~100 px and broke "600 m²" across two lines.
        flex: "1 1 150px",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: "#f8fafc",
      }}
    >
      <Icon size={20} color="#3b82f6" />
      <div style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

/** Compact horizontal variant of StatTile used by the 1-page sheet. */
function SpecChip({ icon: Icon, label, value }: Omit<Spec, "key">) {
  return (
    <div
      style={{
        flex: "1 1 150px",
        minWidth: 0,
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "9px 12px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#f8fafc",
      }}
    >
      <Icon size={18} color="#3b82f6" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "9px", color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function PriceBlock({
  property,
  compact = false,
}: {
  property: FichaProperty;
  compact?: boolean;
}) {
  const mainSize = compact ? "26px" : "30px";
  const dualSize = compact ? "21px" : "24px";
  const dualAltSize = compact ? "19px" : "22px";

  // Solid color rather than gradient-clip: html2canvas does not support
  // -webkit-background-clip: text, which would render the price invisible.
  if (property.show_price === false) {
    return (
      <span style={{ fontSize: dualSize, fontWeight: 700, color: "#475569" }}>
        Precio a consultar
      </span>
    );
  }

  if (property.operation === "VENTA_RENTA") {
    return (
      <>
        {(property.price_sale ?? property.price) > 0 && (
          <span style={{ fontSize: dualSize, fontWeight: 800, color: "#1d4ed8" }}>
            {formatPrice(property.price_sale ?? property.price, property.currency)}
            <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "6px", fontWeight: 500 }}>
              {property.currency} · Venta
            </span>
          </span>
        )}
        {property.price_rent && property.price_rent > 0 && (
          <span style={{ fontSize: dualAltSize, fontWeight: 700, color: "#1d4ed8" }}>
            {formatPrice(property.price_rent, property.currency)}
            <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "6px", fontWeight: 500 }}>
              {property.currency}/mes · Renta
            </span>
          </span>
        )}
        {property.accepts_crypto && <CryptoBadge />}
      </>
    );
  }

  return (
    <>
      <span style={{ fontSize: mainSize, fontWeight: 800, color: "#1d4ed8" }}>
        {formatPrice(
          property.operation === "RENTA"
            ? property.price_rent ?? property.price
            : property.price_sale ?? property.price,
          property.currency,
        )}
      </span>
      <span style={{ color: "#64748b", fontSize: "13px" }}>
        {property.currency}
        {property.operation === "RENTA" ? " /mes" : ""}
      </span>
      {property.accepts_crypto && <CryptoBadge />}
    </>
  );
}

function CryptoBadge() {
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        color: "#16a34a",
        background: "#dcfce7",
        padding: "4px 8px",
        borderRadius: "6px",
      }}
    >
      Acepta cripto
    </span>
  );
}

function HeroBadges({
  operation,
  isBrcCertified,
}: {
  operation: string;
  isBrcCertified: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        display: "flex",
        gap: "8px",
      }}
    >
      <span
        style={{
          background: ACCENT_GRADIENT,
          color: "#fff",
          fontSize: "11px",
          fontWeight: 600,
          padding: "6px 10px",
          borderRadius: "8px",
        }}
      >
        {operationLabel(operation)}
      </span>
      {isBrcCertified && (
        <span
          style={{
            background: "#0f172a",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            padding: "6px 10px",
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ShieldBrc style={{ width: "12px", height: "12px" }} />
          Certificada BRC
        </span>
      )}
    </div>
  );
}

function Thumbnail({ photo, index }: { photo: FichaMedia; index: number }) {
  return (
    <div
      style={{
        // Must fill the sized wrapper: with `height: auto` the inner <img>
        // falls back to its intrinsic height and spills below the grid row.
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        background: "#f1f5f9",
      }}
    >
      <img
        src={photo.url}
        alt={photo.alt_text ?? `Foto ${index + 1}`}
        crossOrigin="anonymous"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

function QrBlock({
  qrDataUrl,
  size,
}: {
  qrDataUrl: string | null;
  size: number;
}) {
  if (!qrDataUrl) return null;
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <img
        src={qrDataUrl}
        alt="QR code"
        style={{ width: `${size}px`, height: `${size}px`, display: "block" }}
      />
      <span
        style={{
          fontSize: "8px",
          color: "#94a3b8",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Ver en línea
      </span>
    </div>
  );
}

export function FichaTecnicaTemplate({
  property,
  media,
  qrDataUrl,
  publicUrl,
  generatedAt,
  options = DEFAULT_FICHA_OPTIONS,
}: FichaTecnicaTemplateProps) {
  const { orientation, layout, includeAllPhotos } = options;
  const isLandscape = orientation === "landscape";
  const isBrcCertified = property.brc_status === "CERTIFICADO";
  const PAGE_STYLE = useMemo(() => pageStyle(orientation), [orientation]);

  const location = useMemo(() => {
    const parts = [property.neighborhood, property.city, property.state].filter(
      Boolean,
    ) as string[];
    return parts.join(", ");
  }, [property.neighborhood, property.city, property.state]);

  const fullAddress = useMemo(() => {
    const showAddress = property.show_address !== false;
    const parts = showAddress
      ? [
          property.address_line,
          property.neighborhood,
          property.city,
          property.state,
          property.zip_code ? `C.P. ${property.zip_code}` : null,
        ]
      : [property.neighborhood, property.city, property.state];
    return (parts.filter(Boolean) as string[]).join(", ");
  }, [
    property.show_address,
    property.address_line,
    property.neighborhood,
    property.city,
    property.state,
    property.zip_code,
  ]);

  const specs = useMemo<Spec[]>(() => {
    const out: Spec[] = [];
    if (property.area_total != null) {
      out.push({ key: "area_total", icon: Ruler, label: "Área total", value: `${property.area_total} m²` });
    }
    if (property.area_built != null) {
      out.push({ key: "area_built", icon: Building2, label: "Construcción", value: `${property.area_built} m²` });
    }
    if (property.bedrooms != null) {
      out.push({ key: "bedrooms", icon: BedDouble, label: "Recámaras", value: String(property.bedrooms) });
    }
    if (property.bathrooms != null) {
      out.push({ key: "bathrooms", icon: Bath, label: "Baños", value: String(property.bathrooms) });
    }
    if (property.parking_spaces != null) {
      out.push({ key: "parking", icon: Car, label: "Estacionamientos", value: String(property.parking_spaces) });
    }
    if (property.floors != null) {
      out.push({ key: "floors", icon: Building2, label: "Pisos / niveles", value: String(property.floors) });
    }
    return out;
  }, [
    property.area_total,
    property.area_built,
    property.bedrooms,
    property.bathrooms,
    property.parking_spaces,
    property.floors,
  ]);

  // Photos for gallery: dedupe featured + media.
  const galleryPhotos = useMemo(() => {
    const urls = new Set<string>();
    const out: FichaMedia[] = [];
    if (property.featured_image_url) {
      urls.add(property.featured_image_url);
      out.push({
        id: "featured",
        url: property.featured_image_url,
        alt_text: "Imagen principal",
      });
    }
    for (const m of media) {
      if (!urls.has(m.url)) {
        urls.add(m.url);
        out.push(m);
      }
    }
    return out.slice(1); // featured already shows on page 1
  }, [property.featured_image_url, media]);

  // 6 photos per gallery page in portrait (2x3), 8 in landscape (4x2).
  const galleryPerPage = isLandscape ? 8 : 6;
  const galleryPages = useMemo(() => {
    const chunks: FichaMedia[][] = [];
    for (let i = 0; i < galleryPhotos.length; i += galleryPerPage) {
      chunks.push(galleryPhotos.slice(i, i + galleryPerPage));
    }
    // Unchecking "incluir todas las fotografías" keeps a single gallery page.
    return includeAllPhotos ? chunks : chunks.slice(0, 1);
  }, [galleryPhotos, galleryPerPage, includeAllPhotos]);

  const totalPages = 2 + galleryPages.length; // cover + details + gallery pages

  // Details page: keep the description + amenities within the page budget.
  const detailsText = isLandscape
    ? DETAILS_TEXT.landscape
    : DETAILS_TEXT.portrait;
  const hasAmenities = (property.amenities?.length ?? 0) > 0;
  const shownAmenities = (property.amenities ?? []).slice(
    0,
    detailsText.maxAmenities,
  );
  const hiddenAmenities = (property.amenities?.length ?? 0) - shownAmenities.length;

  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: "-10000px",
    top: 0,
    pointerEvents: "none",
  };

  // ====================== 1-PAGE SUMMARY ======================
  if (layout === "single") {
    const L = isLandscape ? SINGLE_LAYOUT.landscape : SINGLE_LAYOUT.portrait;
    const thumbs = galleryPhotos.slice(0, L.thumbCount);
    const description = property.description
      ? truncate(property.description, L.descriptionChars)
      : null;

    const heroNode = property.featured_image_url ? (
      <div
        style={{
          flexShrink: 0,
          width: "100%",
          height: `${L.heroHeight}px`,
          borderRadius: "16px",
          overflow: "hidden",
          position: "relative",
          background: "#e2e8f0",
        }}
      >
        <img
          src={property.featured_image_url}
          alt={property.title}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <HeroBadges operation={property.operation} isBrcCertified={isBrcCertified} />
      </div>
    ) : null;

    const titleNode = (
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#3b82f6",
            fontWeight: 600,
            marginBottom: "6px",
          }}
        >
          {typeLabel(property.type)}
        </div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            color: "#0f172a",
          }}
        >
          {truncate(property.title, L.titleChars)}
        </h1>
        <div
          style={{
            marginTop: "10px",
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            color: "#64748b",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          <span style={{ flexShrink: 0, paddingTop: "2px" }}>
            <MapPin size={14} />
          </span>
          <span style={{ minWidth: 0 }}>
            {truncate(fullAddress || location, L.addressChars)}
          </span>
        </div>
      </div>
    );

    const priceNode = (
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          paddingBottom: "14px",
          borderBottom: "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <PriceBlock property={property} compact />
      </div>
    );

    const specsNode = specs.length > 0 && (
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {specs.slice(0, L.specCount).map((s) => (
          <SpecChip key={s.key} icon={s.icon} label={s.label} value={s.value} />
        ))}
      </div>
    );

    const descriptionNode = description && (
      <div style={{ flexShrink: 0 }}>
        <h2 style={SECTION_TITLE_STYLE}>Descripción</h2>
        <p
          style={{
            fontSize: "12.5px",
            lineHeight: 1.6,
            color: "#334155",
            margin: "8px 0 0",
          }}
        >
          {description}
        </p>
      </div>
    );

    const thumbsNode = thumbs.length > 0 && (
      <div style={{ flexShrink: 0 }}>
        <h2 style={SECTION_TITLE_STYLE}>Galería</h2>
        <div
          style={{
            marginTop: "8px",
            display: "grid",
            gridTemplateColumns: `repeat(${L.thumbCols}, 1fr)`,
            gap: "10px",
          }}
        >
          {thumbs.map((m, i) => (
            <div key={m.id ?? `thumb-${i}`} style={{ height: `${L.thumbHeight}px` }}>
              <Thumbnail photo={m} index={i} />
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div style={wrapperStyle} aria-hidden="true">
        <section data-page="1" style={PAGE_STYLE}>
          <PageHeader title="Ficha técnica · Resumen" />

          {isLandscape ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                gap: "28px",
                paddingBottom: `${SINGLE_BOTTOM_SAFETY_PX}px`,
              }}
            >
              {/* Left: hero + thumbnails. No `overflow: hidden` on the columns:
                  html2canvas draws glyphs a couple of px lower than the DOM, so
                  a clip right under the last line shaves it off. The parent row
                  clips instead, 24 px further down. */}
              <div
                style={{
                  width: "470px",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  minHeight: 0,
                }}
              >
                {heroNode}
                {thumbsNode}
              </div>

              {/* Right: data + description + QR */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: `${L.gap}px`,
                }}
              >
                {titleNode}
                {priceNode}
                {specsNode}
                {descriptionNode}
                <div
                  style={{
                    marginTop: "auto",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <QrBlock qrDataUrl={qrDataUrl} size={L.qrSize} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#0f172a",
                        fontWeight: 600,
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                      }}
                    >
                      {publicUrl}
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#94a3b8",
                        marginTop: "4px",
                        lineHeight: 1.45,
                      }}
                    >
                      Escanea el código para ver la propiedad completa y todas las fotografías.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: `${L.gap}px`,
                paddingBottom: `${SINGLE_BOTTOM_SAFETY_PX}px`,
              }}
            >
              {heroNode}
              {titleNode}
              {priceNode}
              {specsNode}
              {descriptionNode}
              {/* Follows the description instead of being pinned to the bottom:
                  the spare height reserved for text growth then shows up as a
                  bottom margin rather than as a hole in the middle. */}
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "16px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>{thumbsNode}</div>
                <QrBlock qrDataUrl={qrDataUrl} size={L.qrSize} />
              </div>
            </div>
          )}

          <PageFooter pageNum={1} totalPages={1} generatedAt={generatedAt} />
        </section>
      </div>
    );
  }

  // ====================== FULL SHEET ======================
  return (
    <div style={wrapperStyle} aria-hidden="true">
      {/* ====================== PAGE 1: COVER ====================== */}
      <section data-page="1" style={PAGE_STYLE}>
        <PageHeader title="Ficha técnica" />

        {/* Hero image */}
        {property.featured_image_url && (
          <div
            style={{
              width: "100%",
              height: isLandscape ? "230px" : "280px",
              borderRadius: "16px",
              overflow: "hidden",
              marginBottom: "24px",
              position: "relative",
              background: "#e2e8f0",
            }}
          >
            <img
              src={property.featured_image_url}
              alt={property.title}
              crossOrigin="anonymous"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <HeroBadges operation={property.operation} isBrcCertified={isBrcCertified} />
          </div>
        )}

        {/* Title + location */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#3b82f6",
              fontWeight: 600,
              marginBottom: "6px",
            }}
          >
            {typeLabel(property.type)}
          </div>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              lineHeight: 1.3,
              margin: 0,
              color: "#0f172a",
            }}
          >
            {property.title}
          </h1>
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
              color: "#64748b",
              fontSize: "13px",
              lineHeight: 1.45,
            }}
          >
            <span style={{ flexShrink: 0, paddingTop: "2px" }}>
              <MapPin size={14} />
            </span>
            <span>{location}</span>
          </div>
        </div>

        {/* Price */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "12px",
            marginBottom: "24px",
            paddingBottom: "20px",
            borderBottom: "1px solid #e2e8f0",
            flexWrap: "wrap",
          }}
        >
          <PriceBlock property={property} />
        </div>

        {/* Specs grid */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          {specs.map((s) => (
            <StatTile key={s.key} icon={s.icon} label={s.label} value={s.value} />
          ))}
        </div>

        <PageFooter
          pageNum={1}
          totalPages={totalPages}
          generatedAt={generatedAt}
        />
      </section>

      {/* ====================== PAGE 2: DETAILS ====================== */}
      <section data-page="2" style={PAGE_STYLE}>
        <PageHeader title="Detalles" />

        {/* Description — bounded so the QR card and the footer below always fit;
            a description longer than the page used to push them out of it. */}
        {property.description && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={SECTION_TITLE_STYLE}>Descripción</h2>
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.65,
                color: "#334155",
                whiteSpace: "pre-wrap",
                marginTop: "10px",
              }}
            >
              {truncateToLines(
                property.description,
                hasAmenities
                  ? detailsText.linesWithAmenities
                  : detailsText.linesWithoutAmenities,
                detailsText.charsPerLine,
              )}
            </p>
          </div>
        )}

        {/* Amenities */}
        {hasAmenities && (
          <div style={{ marginBottom: "24px" }}>
            <h2 style={SECTION_TITLE_STYLE}>Amenidades</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isLandscape ? "1fr 1fr 1fr" : "1fr 1fr",
                gap: "8px 16px",
                marginTop: "12px",
              }}
            >
              {shownAmenities.map((a, i) => (
                <div
                  key={`${a}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <CheckCircle2 size={14} color="#16a34a" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
            {hiddenAmenities > 0 && (
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "10px" }}>
                y {hiddenAmenities} amenidad{hiddenAmenities === 1 ? "" : "es"} más
              </div>
            )}
          </div>
        )}

        {/* Address + metadata */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: "10px" }}>
              Ubicación
            </h2>
            <p style={{ fontSize: "12px", color: "#334155", lineHeight: 1.6, margin: 0 }}>
              {fullAddress}
            </p>
          </div>
          <div>
            <h2 style={{ ...SECTION_TITLE_STYLE, marginBottom: "10px" }}>
              Datos generales
            </h2>
            <dl style={{ fontSize: "12px", color: "#334155", margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed #e2e8f0" }}>
                <dt style={{ color: "#64748b" }}>Tipo</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{typeLabel(property.type)}</dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed #e2e8f0" }}>
                <dt style={{ color: "#64748b" }}>Operación</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{operationLabel(property.operation)}</dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed #e2e8f0" }}>
                <dt style={{ color: "#64748b" }}>Estado BRC</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {isBrcCertified ? "Certificada" : "No certificada"}
                </dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <dt style={{ color: "#64748b" }}>Cripto</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {property.accepts_crypto ? "Aceptado" : "No aceptado"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* QR + URL */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            padding: "20px",
            background: "#f8fafc",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
          }}
        >
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR code"
              style={{ width: "100px", height: "100px", display: "block" }}
            />
          )}
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
              Ver en línea
            </div>
            <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600, wordBreak: "break-all" }}>
              {publicUrl}
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px", maxWidth: "320px" }}>
              Escanea el código para abrir esta propiedad en el sitio. La información del corredor se proporciona a solicitud expresa desde la plataforma.
            </div>
          </div>
        </div>

        <PageFooter
          pageNum={2}
          totalPages={totalPages}
          generatedAt={generatedAt}
        />
      </section>

      {/* ====================== GALLERY PAGES ====================== */}
      {galleryPages.map((chunk, idx) => {
        const pageNum = 3 + idx;
        return (
          <section key={`gallery-${idx}`} data-page={pageNum} style={PAGE_STYLE}>
            <PageHeader title={`Galería · ${idx + 1}`} />
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: isLandscape ? "1fr 1fr 1fr 1fr" : "1fr 1fr",
                gridTemplateRows: isLandscape ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                gap: "12px",
              }}
            >
              {chunk.map((m, mIdx) => (
                <div
                  key={m.id ?? `m-${mIdx}`}
                  style={{
                    minHeight: 0,
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                    position: "relative",
                  }}
                >
                  <img
                    src={m.url}
                    alt={m.alt_text ?? `Foto ${mIdx + 1}`}
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {m.alt_text && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: "10px",
                        left: "10px",
                        background: "rgba(15, 23, 42, 0.78)",
                        color: "#fff",
                        fontSize: "11px",
                        padding: "5px 10px",
                        borderRadius: "8px",
                      }}
                    >
                      {m.alt_text}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <PageFooter
              pageNum={pageNum}
              totalPages={totalPages}
              generatedAt={generatedAt}
            />
          </section>
        );
      })}
    </div>
  );
}
