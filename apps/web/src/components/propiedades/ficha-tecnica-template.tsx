"use client";

/**
 * Off-screen printable layout used by the "Descargar ficha técnica" feature.
 *
 * Each direct child marked with `data-page` is captured by html2canvas as a
 * standalone PDF page. Dimensions match A4 portrait at 96 DPI (794x1123 px)
 * so the resulting PDF preserves the visual proportions of the screen render.
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

export interface FichaProperty {
  id: string;
  title: string;
  type: string;
  operation: string;
  description: string | null;
  price: number;
  currency: string;
  accepts_crypto: boolean;
  area_total: number | null;
  area_built: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  floors: number | null;
  address_line: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string | null;
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
}

const PAGE_STYLE: React.CSSProperties = {
  width: "794px",
  height: "1123px",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  position: "relative",
  padding: "48px 56px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const ACCENT_GRADIENT =
  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))";

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
  if (op === "TRASPASO") return "En traspaso";
  return op;
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    CASA: "Casa",
    DEPARTAMENTO: "Departamento",
    TERRENO: "Terreno",
    OFICINA: "Oficina",
    LOCAL_COMERCIAL: "Local comercial",
    BODEGA: "Bodega",
    EDIFICIO: "Edificio",
    QUINTA: "Quinta",
  };
  return map[t] ?? t;
}

function PageHeader({ title }: { title: string }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "16px",
        borderBottom: "1px solid #e2e8f0",
        marginBottom: "24px",
      }}
    >
      <img
        src="/images/Logo-BitHauss-Texto-Negro.png"
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

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 0",
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
      <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

export function FichaTecnicaTemplate({
  property,
  media,
  qrDataUrl,
  publicUrl,
  generatedAt,
}: FichaTecnicaTemplateProps) {
  const isBrcCertified = property.brc_status === "CERTIFICADO";
  const location = useMemo(() => {
    const parts = [property.neighborhood, property.city, property.state].filter(
      Boolean,
    ) as string[];
    return parts.join(", ");
  }, [property.neighborhood, property.city, property.state]);

  const fullAddress = useMemo(() => {
    const parts = [
      property.address_line,
      property.neighborhood,
      property.city,
      property.state,
      property.zip_code ? `C.P. ${property.zip_code}` : null,
    ].filter(Boolean) as string[];
    return parts.join(", ");
  }, [
    property.address_line,
    property.neighborhood,
    property.city,
    property.state,
    property.zip_code,
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

  // 2 photos per gallery page (top + bottom).
  const galleryPages = useMemo(() => {
    const chunks: FichaMedia[][] = [];
    for (let i = 0; i < galleryPhotos.length; i += 2) {
      chunks.push(galleryPhotos.slice(i, i + 2));
    }
    return chunks;
  }, [galleryPhotos]);

  const totalPages = 2 + galleryPages.length; // cover + details + gallery pages

  return (
    <div
      style={{
        position: "absolute",
        left: "-10000px",
        top: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* ====================== PAGE 1: COVER ====================== */}
      <section data-page="1" style={PAGE_STYLE}>
        <PageHeader title="Ficha técnica" />

        {/* Hero image */}
        {property.featured_image_url && (
          <div
            style={{
              width: "100%",
              height: "280px",
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
                {operationLabel(property.operation)}
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
              lineHeight: 1.2,
              margin: 0,
              color: "#0f172a",
            }}
          >
            {property.title}
          </h1>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            <MapPin size={14} />
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
          }}
        >
          {/* Solid color rather than gradient-clip: html2canvas does not support
              -webkit-background-clip: text, which would render the price invisible. */}
          <span
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: "#1d4ed8",
            }}
          >
            {formatPrice(property.price, property.currency)}
          </span>
          <span style={{ color: "#64748b", fontSize: "13px" }}>
            {property.currency}
          </span>
          {property.accepts_crypto && (
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
          )}
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
          {property.area_total != null && (
            <StatTile
              icon={Ruler}
              label="Área total"
              value={`${property.area_total} m²`}
            />
          )}
          {property.area_built != null && (
            <StatTile
              icon={Building2}
              label="Construcción"
              value={`${property.area_built} m²`}
            />
          )}
          {property.bedrooms != null && (
            <StatTile
              icon={BedDouble}
              label="Recámaras"
              value={String(property.bedrooms)}
            />
          )}
          {property.bathrooms != null && (
            <StatTile
              icon={Bath}
              label="Baños"
              value={String(property.bathrooms)}
            />
          )}
          {property.parking_spaces != null && (
            <StatTile
              icon={Car}
              label="Estacionamientos"
              value={String(property.parking_spaces)}
            />
          )}
          {property.floors != null && (
            <StatTile
              icon={Building2}
              label="Pisos / niveles"
              value={String(property.floors)}
            />
          )}
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

        {/* Description */}
        {property.description && (
          <div style={{ marginBottom: "24px" }}>
            <h2
              style={{
                fontSize: "13px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#3b82f6",
                fontWeight: 700,
                marginBottom: "10px",
                margin: 0,
              }}
            >
              Descripción
            </h2>
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.65,
                color: "#334155",
                whiteSpace: "pre-wrap",
                marginTop: "10px",
              }}
            >
              {property.description}
            </p>
          </div>
        )}

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2
              style={{
                fontSize: "13px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#3b82f6",
                fontWeight: 700,
                marginBottom: "12px",
                margin: 0,
              }}
            >
              Amenidades
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 16px",
                marginTop: "12px",
              }}
            >
              {property.amenities.map((a, i) => (
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
            <h2
              style={{
                fontSize: "13px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#3b82f6",
                fontWeight: 700,
                margin: 0,
                marginBottom: "10px",
              }}
            >
              Ubicación
            </h2>
            <p style={{ fontSize: "12px", color: "#334155", lineHeight: 1.6, margin: 0 }}>
              {fullAddress}
            </p>
          </div>
          <div>
            <h2
              style={{
                fontSize: "13px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#3b82f6",
                fontWeight: 700,
                margin: 0,
                marginBottom: "10px",
              }}
            >
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
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {chunk.map((m, mIdx) => (
                <div
                  key={m.id ?? `m-${mIdx}`}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: "14px",
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
