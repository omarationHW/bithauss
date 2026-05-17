"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";

/* ------------------------------------------------------------------ */
/*  Brand tokens (Identidad Institucional BRC - BitHauss)              */
/* ------------------------------------------------------------------ */

const COLORS = {
  navy: "#1B2A4A",       // Azul Marino Institucional - Pantone 289 C
  gold: "#8B6914",       // Dorado de Seguridad     - Pantone 132 C
  forest: "#2D4A3E",     // Verde Oscuro Bancario   - Pantone 560 C
  guilloche: "#3D6B5A",  // Verde Guilloche         - Pantone 5535 C
  paper: "#E8EDE5",      // Crema Papel Seguridad   - Pantone 7527 C
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CertificateData {
  id: string;
  certificate_number: string;
  qr_code_url: string | null;
  pdf_url: string | null;
  issued_at: string;
  expires_at: string;
  created_at: string;
  properties: {
    id: string;
    title: string;
    address_line: string | null;
    city: string | null;
    state: string | null;
    price: number;
    currency: string;
    featured_image_url: string | null;
  } | null;
  issued_by_profile: {
    first_name: string;
    last_name: string;
  } | null;
  notary_profile: {
    notary_number: string;
    notary_state: string;
  } | null;
  brc_expedientes: {
    status: string;
    created_at: string;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric" });
}
function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", { month: "long" });
}
function formatYearTwoDigits(dateStr: string) {
  return String(new Date(dateStr).getFullYear()).slice(-2);
}

function splitCertNumber(num: string) {
  const cleaned = (num || "").replace(/[^A-Z0-9-]/gi, "");
  if (cleaned.includes("-")) {
    const [serie, folio] = cleaned.split("-");
    return {
      serie: (serie || "AAA-000").padEnd(7, "0"),
      folio: (folio || "000000").padStart(6, "0"),
    };
  }
  return {
    serie: cleaned.slice(0, 7) || "AAA-000",
    folio: cleaned.slice(-6) || "000000",
  };
}

/* ------------------------------------------------------------------ */
/*  Guilloche SVG background                                           */
/* ------------------------------------------------------------------ */

function GuillochePattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1000 1500"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {/* Wave pattern - thin lines */}
        <pattern
          id="wave-pattern"
          x="0"
          y="0"
          width="40"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 10 Q 10 0, 20 10 T 40 10"
            fill="none"
            stroke={COLORS.guilloche}
            strokeWidth="0.4"
            opacity="0.35"
          />
        </pattern>

        {/* Diagonal cross pattern */}
        <pattern
          id="diag-pattern"
          x="0"
          y="0"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="14"
            stroke={COLORS.guilloche}
            strokeWidth="0.3"
            opacity="0.25"
          />
        </pattern>

        {/* Radial rosette (corner medallions) */}
        <radialGradient id="rosette-grad">
          <stop offset="0%" stopColor={COLORS.guilloche} stopOpacity="0.55" />
          <stop offset="60%" stopColor={COLORS.guilloche} stopOpacity="0.25" />
          <stop offset="100%" stopColor={COLORS.guilloche} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Paper base */}
      <rect width="1000" height="1500" fill={COLORS.paper} />

      {/* Wave overlay */}
      <rect width="1000" height="1500" fill="url(#wave-pattern)" />

      {/* Diagonal overlay */}
      <rect width="1000" height="1500" fill="url(#diag-pattern)" opacity="0.6" />

      {/* Corner rosettes - dense guilloche circles */}
      {[
        { cx: 0, cy: 0 },
        { cx: 1000, cy: 0 },
        { cx: 0, cy: 1500 },
        { cx: 1000, cy: 1500 },
      ].map((p, idx) => (
        <g key={idx}>
          <circle cx={p.cx} cy={p.cy} r="350" fill="url(#rosette-grad)" />
          {Array.from({ length: 18 }).map((_, i) => (
            <circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={40 + i * 18}
              fill="none"
              stroke={COLORS.guilloche}
              strokeWidth="0.35"
              opacity="0.35"
            />
          ))}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * Math.PI) / 18;
            const x2 = p.cx + Math.cos(angle) * 360;
            const y2 = p.cy + Math.sin(angle) * 360;
            return (
              <line
                key={i}
                x1={p.cx}
                y1={p.cy}
                x2={x2}
                y2={y2}
                stroke={COLORS.guilloche}
                strokeWidth="0.25"
                opacity="0.2"
              />
            );
          })}
        </g>
      ))}

      {/* Side rosettes (mid edges) */}
      {[
        { cx: 0, cy: 750 },
        { cx: 1000, cy: 750 },
      ].map((p, idx) => (
        <g key={`side-${idx}`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={60 + i * 20}
              fill="none"
              stroke={COLORS.guilloche}
              strokeWidth="0.3"
              opacity="0.3"
            />
          ))}
        </g>
      ))}

      {/* Central watermark rosette - very faint */}
      <g opacity="0.18">
        {Array.from({ length: 24 }).map((_, i) => (
          <circle
            key={i}
            cx="500"
            cy="750"
            r={20 + i * 22}
            fill="none"
            stroke={COLORS.guilloche}
            strokeWidth="0.35"
          />
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Diagonal Watermarks                                                */
/* ------------------------------------------------------------------ */

function Watermarks() {
  const lines = [
    "BIEN RAIZ CERTIFICADO",
    "CERTIFICADO BRC",
    "DOCUMENTO VALIDADO",
    "CERTIFICADO OFICIAL",
    "BIEN RAIZ CERTIFICADO",
    "NO REPRODUCIR",
    "CERTIFICADO BRC",
    "DOCUMENTO VALIDADO",
    "BIEN RAIZ CERTIFICADO",
    "CERTIFICADO OFICIAL",
    "CERTIFICADO BRC",
    "BIEN RAIZ CERTIFICADO",
  ];
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      style={{
        transform: "rotate(-30deg)",
        transformOrigin: "center center",
      }}
    >
      <div className="flex flex-col items-center justify-center h-[140%] w-[160%] -ml-[30%] -mt-[20%] gap-[60px]">
        {lines.map((line, i) => (
          <div
            key={i}
            className="whitespace-nowrap font-bold tracking-[0.4em]"
            style={{
              color: COLORS.forest,
              opacity: 0.06,
              fontSize: "38px",
              fontFamily: "var(--font-cinzel), serif",
            }}
          >
            {line + "   " + line + "   " + line}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Holographic BRC Seal                                               */
/* ------------------------------------------------------------------ */

function BRCSeal() {
  return (
    <div className="relative w-[110px] h-[110px] shrink-0">
      {/* Outer holographic ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, #8B6914, #C9A227, #E8D275, #9BC4BC, #4DA8DA, #8F6BBD, #D96EA0, #E8945A, #C9A227, #8B6914)",
          padding: "4px",
        }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #2A3B5C 0%, #1B2A4A 60%, #0E1A33 100%)",
            boxShadow:
              "inset 0 2px 8px rgba(255,255,255,0.25), inset 0 -4px 10px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {/* Inner highlight ring */}
      <div
        className="absolute inset-[10px] rounded-full"
        style={{
          border: `1px solid ${COLORS.gold}`,
          opacity: 0.8,
        }}
      />

      {/* BRC text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-black tracking-wider"
          style={{
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "26px",
            background:
              "linear-gradient(135deg, #F5E6A8 0%, #FFFFFF 30%, #C9A227 60%, #8B6914 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
            letterSpacing: "0.08em",
          }}
        >
          BRC
        </span>
      </div>

      {/* Specular highlight */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 28% 25%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 35%)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BitHauss small logo (for QR block)                                 */
/* ------------------------------------------------------------------ */

function BitHaussMark() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md"
      style={{
        background: "linear-gradient(160deg, #1F8F6F 0%, #14654E 100%)",
        width: "70px",
        height: "70px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
      }}
    >
      <span
        className="text-white font-black leading-none"
        style={{
          fontFamily: "var(--font-cinzel), serif",
          fontSize: "26px",
        }}
      >
        [3
      </span>
      <span
        className="text-white font-semibold mt-1"
        style={{
          fontFamily: "var(--font-didact-gothic), sans-serif",
          fontSize: "10px",
          letterSpacing: "0.02em",
        }}
      >
        BitHauss
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function CertificateSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-200 pt-[120px] pb-12">
      <div className="mx-auto max-w-[860px] px-4">
        <div className="animate-pulse">
          <div
            className="mx-auto bg-white shadow-2xl"
            style={{ width: "100%", aspectRatio: "216 / 356" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Checklist content                                                  */
/* ------------------------------------------------------------------ */

const VALIDATION_CHECKLIST = [
  "Se encuentra Libre de gravámenes, hipotecas y embargos",
  "Escrituras públicas debidamente inscritas",
  "Certificado de libertad de gravamen vigente",
  "Pagos de impuesto predial al corriente",
  "Alineamiento y número oficial",
  "Constancia de no adeudo de agua",
  "Identificación y legitimación del propietario verificada",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CertificadoPage() {
  const params = useParams();
  const certificateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const certRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);

  /* ------------------ Fetch ------------------ */
  useEffect(() => {
    async function fetchCertificate() {
      if (!certificateId) return;

      const { data: certData, error: certError } = await supabase
        .from("brc_certificates")
        .select(
          "id, certificate_number, qr_code_url, pdf_url, issued_at, issued_by, expires_at, created_at, property_id, expediente_id"
        )
        .eq("id", certificateId)
        .maybeSingle();

      if (!certData || certError) {
        logError("Cert fetch error:", certError);
        setLoading(false);
        return;
      }

      let issuedByProfile = null;
      let notaryProfile = null;

      if (certData.issued_by) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", certData.issued_by)
          .maybeSingle();
        issuedByProfile = profileData;

        const { data: notaryData } = await supabase
          .from("notary_profiles")
          .select("notary_number, notary_state")
          .eq("profile_id", certData.issued_by)
          .maybeSingle();
        notaryProfile = notaryData;
      }

      let propertyData = null;
      if (certData.property_id) {
        const { data: pData } = await supabase
          .from("properties")
          .select(
            "id, title, address_line, city, state, price, currency, featured_image_url"
          )
          .eq("id", certData.property_id)
          .maybeSingle();
        propertyData = pData;
      }

      let expedienteData = null;
      if (certData.expediente_id) {
        const { data: eData } = await supabase
          .from("brc_expedientes")
          .select("status, created_at")
          .eq("id", certData.expediente_id)
          .maybeSingle();
        expedienteData = eData;
      }

      setCertificate({
        ...(certData as unknown as CertificateData),
        properties: propertyData,
        brc_expedientes: expedienteData,
        issued_by_profile: issuedByProfile,
        notary_profile: notaryProfile,
      });
      setLoading(false);
    }

    fetchCertificate();
  }, [certificateId, supabase]);

  /* ------------------ Responsive scaling ------------------ */
  useEffect(() => {
    function updateScale() {
      if (!wrapperRef.current) return;
      const availableWidth = wrapperRef.current.offsetWidth;
      // Certificate native width is 816px (8.5 inch at 96dpi)
      const nativeWidth = 816;
      setScale(Math.min(1, availableWidth / nativeWidth));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [loading]);

  /* ------------------ QR code (local generation, no CORS) ------------------ */
  useEffect(() => {
    if (!certificate) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/certificado/${certificate.id}`
        : `/certificado/${certificate.id}`;

    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: "H",
          margin: 0,
          width: 240,
          color: { dark: COLORS.navy, light: "#ffffff" },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        logError("QR generation error:", err);
      }
    })();
  }, [certificate]);

  /* ------------------ Download PDF ------------------ */
  const handleDownload = useCallback(async () => {
    if (!certRef.current || downloading) return;
    setDownloading(true);
    try {
      // Wait for fonts to be ready (web fonts can render late in html2canvas)
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: COLORS.paper,
        logging: false,
        imageTimeout: 15000,
        windowWidth: 816,
        windowHeight: 1344,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [216, 356], // Oficio / Legal
        compress: true,
      });
      pdf.addImage(imgData, "JPEG", 0, 0, 216, 356, undefined, "FAST");
      const filename = `certificado-brc-${certificate?.certificate_number ?? "documento"}.pdf`;
      pdf.save(filename);
    } catch (err) {
      logError("Download error:", err);
      if (typeof window !== "undefined") {
        window.alert(
          "No se pudo generar el PDF. Intenta recargar la página o usar otro navegador."
        );
      }
    } finally {
      setDownloading(false);
    }
  }, [certificate, downloading]);

  /* ------------------ Loading ------------------ */
  if (loading) return <CertificateSkeleton />;

  /* ------------------ Not found ------------------ */
  if (!certificate) {
    return (
      <div className="min-h-screen bg-neutral-200 pt-[120px]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="h-16 w-16 text-gray-300 mb-4" />
            <h2
              className="text-xl font-bold text-gray-900 mb-2"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              Certificado no encontrado
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              El certificado solicitado no existe o ha sido removido.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------ Render ------------------ */
  const property =
    certificate.properties ?? {
      id: "",
      title: "Propiedad",
      address_line: null,
      city: null,
      state: null,
      price: 0,
      currency: "MXN",
      featured_image_url: null,
    };

  const address =
    [property.address_line, property.city, property.state]
      .filter(Boolean)
      .join(", ") || "[Calle, Número, Colonia, Municipio, Estado, C.P.]";

  const { serie, folio } = splitCertNumber(certificate.certificate_number);

  const notaryName = certificate.issued_by_profile
    ? `${certificate.issued_by_profile.first_name} ${certificate.issued_by_profile.last_name}`
    : "";
  const notaryNumber = certificate.notary_profile?.notary_number ?? "";
  const notaryState = certificate.notary_profile?.notary_state ?? "";

  const issuedDay = formatDay(certificate.issued_at);
  const issuedMonth = formatMonth(certificate.issued_at);
  const issuedYear = formatYearTwoDigits(certificate.issued_at);
  const issuedPlace = notaryState || "____________";

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/certificado/${certificate.id}`
      : `/certificado/${certificate.id}`;

  return (
    <div className="min-h-screen bg-neutral-300 pt-[110px] pb-12">
      <div className="mx-auto max-w-[840px] px-4">
        {/* Top toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            className="rounded-xl text-gray-700 hover:bg-white/60"
          >
            <Link href={property.id ? `/propiedades/${property.id}` : "/"}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl text-white px-5 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.forest})`,
            }}
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar certificado
              </>
            )}
          </Button>
        </div>

        {/* Certificate viewport (responsive scaled) */}
        <div ref={wrapperRef} className="w-full">
          <div
            className="mx-auto shadow-2xl"
            style={{
              width: 816 * scale,
              height: 1344 * scale,
              position: "relative",
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
              }}
            >
              <CertificateDocument
                ref={certRef}
                serie={serie}
                folio={folio}
                address={address}
                certNumber={certificate.certificate_number}
                notaryName={notaryName}
                notaryNumber={notaryNumber}
                issuedPlace={issuedPlace}
                issuedDay={issuedDay}
                issuedMonth={issuedMonth}
                issuedYear={issuedYear}
                verifyUrl={verifyUrl}
                qrDataUrl={qrDataUrl}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Certificate Document - fixed Oficio dimensions (816x1344 @96dpi)   */
/*  Oficio: 216mm x 356mm = 8.5" x 14" = 816px x 1344px (96dpi)        */
/* ------------------------------------------------------------------ */

interface CertificateDocumentProps {
  serie: string;
  folio: string;
  address: string;
  certNumber: string;
  notaryName: string;
  notaryNumber: string;
  issuedPlace: string;
  issuedDay: string;
  issuedMonth: string;
  issuedYear: string;
  verifyUrl: string;
  qrDataUrl: string;
}

const CertificateDocument = ({
  ref,
  serie,
  folio,
  address,
  certNumber,
  notaryName,
  notaryNumber,
  issuedPlace,
  issuedDay,
  issuedMonth,
  issuedYear,
  qrDataUrl,
}: CertificateDocumentProps & { ref?: React.Ref<HTMLDivElement> }) => {
  return (
    <div
      ref={ref}
      style={{
        width: "816px",
        height: "1344px",
        backgroundColor: COLORS.paper,
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-didact-gothic), sans-serif",
        color: COLORS.navy,
      }}
    >
      {/* Outer security border - verde oscuro 3px */}
      <div
        style={{
          position: "absolute",
          inset: "18px",
          border: `3px solid ${COLORS.forest}`,
          pointerEvents: "none",
        }}
      />
      {/* Inner border - dorado 2px */}
      <div
        style={{
          position: "absolute",
          inset: "27px",
          border: `2px solid ${COLORS.gold}`,
          pointerEvents: "none",
        }}
      />

      {/* Guilloche background */}
      <div style={{ position: "absolute", inset: "29px", overflow: "hidden" }}>
        <GuillochePattern />
        <Watermarks />
      </div>

      {/* Side rotated text - LEFT */}
      <div
        style={{
          position: "absolute",
          left: "34px",
          top: "50%",
          transform: "translateY(-50%) rotate(-90deg)",
          transformOrigin: "left center",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-ibm-plex-mono), monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: COLORS.forest,
          opacity: 0.85,
        }}
      >
        DOCUMENTO VÁLIDO ÚNICAMENTE DENTRO DEL ECOSISTEMA BITHAUSS. www.bithauss.com
      </div>

      {/* Content */}
      <div
        style={{
          position: "absolute",
          inset: "60px 80px",
          display: "flex",
          flexDirection: "column",
          color: COLORS.navy,
        }}
      >
        {/* ---------- Header: Serie + Folio ---------- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            fontSize: "11px",
            letterSpacing: "0.06em",
            color: COLORS.navy,
            marginBottom: "8px",
          }}
        >
          <span>Serie: {serie}</span>
          <span>Folio: {folio}</span>
        </div>

        {/* Gold double-line divider */}
        <div
          style={{
            borderTop: `2px solid ${COLORS.gold}`,
            borderBottom: `0.5px solid ${COLORS.gold}`,
            paddingBottom: "1px",
            marginBottom: "18px",
          }}
        />

        {/* ---------- Institutional tag ---------- */}
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "13px",
            letterSpacing: "0.32em",
            color: COLORS.navy,
            fontWeight: 500,
            marginBottom: "10px",
          }}
        >
          DOCUMENTO DE SEGURIDAD INMOBILIARIA
        </p>

        {/* ---------- Main Title: CERTIFICADO ---------- */}
        <h1
          style={{
            textAlign: "center",
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "72px",
            lineHeight: 1,
            fontWeight: 700,
            color: COLORS.navy,
            letterSpacing: "0.06em",
            margin: 0,
            marginBottom: "10px",
          }}
        >
          CERTIFICADO
        </h1>

        {/* Small gold rule */}
        <div
          style={{
            width: "70%",
            margin: "0 auto 10px",
            borderTop: `1px solid ${COLORS.gold}`,
          }}
        />

        <h2
          style={{
            textAlign: "center",
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "22px",
            color: COLORS.gold,
            letterSpacing: "0.22em",
            margin: 0,
            fontWeight: 600,
            marginBottom: "10px",
          }}
        >
          DE VALIDACIÓN INMOBILIARIA
        </h2>

        <div
          style={{
            width: "55%",
            margin: "0 auto 8px",
            borderTop: `1px solid ${COLORS.gold}`,
          }}
        />

        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-cinzel), serif",
            fontSize: "11px",
            color: COLORS.gold,
            letterSpacing: "0.28em",
            fontWeight: 500,
            marginBottom: "22px",
          }}
        >
          INMUEBLE APTO PARA COMERCIALIZACIÓN
        </p>

        {/* ---------- Statement ---------- */}
        <p
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: COLORS.navy,
            marginBottom: "10px",
          }}
        >
          Se hace constar que el inmueble ubicado en:
        </p>

        {/* Address - Playfair Display */}
        <div
          style={{
            textAlign: "center",
            fontFamily: "var(--font-playfair), serif",
            fontSize: "15px",
            color: COLORS.navy,
            fontWeight: 600,
            borderBottom: `1px solid ${COLORS.navy}`,
            paddingBottom: "4px",
            margin: "0 30px 18px",
            fontStyle: "italic",
          }}
        >
          {address}
        </div>

        {/* ---------- Field lines ---------- */}
        <FieldRow label="Con número de escritura pública:" />
        <FieldRow label="Inscrito en el Registro Público de la Propiedad bajo el folio Real No:" />
        <FieldRow label="Superficie total del terreno:" suffix="m²" widthPct={28} />
        <FieldRow label="Superficie construida:" suffix="m²" widthPct={28} />

        {/* ---------- Body intro for checklist ---------- */}
        <p
          style={{
            fontSize: "12px",
            color: COLORS.navy,
            marginTop: "10px",
            marginBottom: "10px",
            lineHeight: 1.45,
          }}
        >
          <strong style={{ fontWeight: 700, letterSpacing: "0.04em" }}>
            HA SIDO VALIDADO DOCUMENTALMENTE
          </strong>{" "}
          cumpliendo con todos los requisitos legales vigentes para su comercialización. Se certifica que el inmueble:
        </p>

        {/* ---------- Checklist + QR + Logo ---------- */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "20px",
            marginBottom: "18px",
          }}
        >
          <ul
            style={{
              flex: 1,
              listStyle: "none",
              padding: 0,
              margin: 0,
              fontSize: "12px",
              color: COLORS.navy,
              lineHeight: 1.8,
              paddingLeft: "12px",
            }}
          >
            {VALIDATION_CHECKLIST.map((item) => (
              <li key={item} style={{ display: "flex", gap: "8px" }}>
                <span style={{ color: COLORS.forest, fontWeight: 700 }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* QR + BitHauss mark */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              width: "190px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {qrDataUrl ? (
                // Using <img> instead of next/image: data URL avoids CORS/taint
                // issues when html2canvas rasterizes the document.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR de verificación"
                  width={86}
                  height={86}
                  style={{
                    border: `1px solid ${COLORS.navy}`,
                    background: "#fff",
                    padding: "3px",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 86,
                    height: 86,
                    border: `1px solid ${COLORS.navy}`,
                    background: "#fff",
                  }}
                />
              )}
              <BitHaussMark />
            </div>
            <p
              style={{
                textAlign: "center",
                fontFamily: "var(--font-cinzel), serif",
                fontSize: "9px",
                color: COLORS.gold,
                letterSpacing: "0.16em",
                fontWeight: 600,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              CERTIFICADO BRC
              <br />
              TOKENIZADO EN
              <br />
              LA BLOCKCHAIN
            </p>
          </div>
        </div>

        {/* ---------- Section divider with title ---------- */}
        <div style={{ position: "relative", margin: "8px 0 12px" }}>
          <div
            style={{
              borderTop: `1px solid ${COLORS.gold}`,
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
            }}
          />
          <p
            style={{
              position: "relative",
              textAlign: "center",
              fontFamily: "var(--font-cinzel), serif",
              fontSize: "11px",
              letterSpacing: "0.28em",
              color: COLORS.navy,
              fontWeight: 600,
              background: COLORS.paper,
              display: "inline-block",
              padding: "0 16px",
              margin: "0 auto",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            DATOS Y CONDICIONES DE EXPEDICIÓN
          </p>
        </div>

        {/* ---------- Lugar y fecha ---------- */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "6px",
            fontSize: "12px",
            color: COLORS.navy,
            marginBottom: "12px",
            justifyContent: "center",
          }}
        >
          <span>Lugar y fecha:</span>
          <FieldFill width="220px" value={issuedPlace} />
          <span>, a</span>
          <FieldFill width="34px" value={issuedDay} />
          <span>de</span>
          <FieldFill width="100px" value={issuedMonth} />
          <span>de 20</span>
          <FieldFill width="34px" value={issuedYear} />
        </div>

        {/* ---------- Vigencia ---------- */}
        <p
          style={{
            fontSize: "11px",
            color: COLORS.navy,
            lineHeight: 1.5,
            textAlign: "justify",
            marginBottom: "16px",
          }}
        >
          <strong style={{ fontWeight: 700 }}>Vigencia:</strong> 90 días naturales a partir de la fecha de expedición. Vigencia y validez sujeta a que el propietario del Inmueble documentalmente Certificado, no realice modificaciones a la documentación revisada ni cambie ni permita se cambie el estatus del Inmueble en el Registro Público de la Propiedad durante dicho plazo. Sujeto a los Términos y Condiciones del servicio BRC.
        </p>

        {/* ---------- Notary signature row with central seal ---------- */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "20px",
            marginTop: "auto",
            marginBottom: "14px",
          }}
        >
          {/* Left signature */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                borderTop: `1px solid ${COLORS.navy}`,
                marginBottom: "4px",
              }}
            />
            <p
              style={{
                fontSize: "11px",
                color: COLORS.navy,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {notaryName || "Notario Público"}
              <br />
              <span style={{ fontSize: "10px" }}>
                Notaría No.{" "}
                <span
                  style={{
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    letterSpacing: "0.05em",
                  }}
                >
                  {notaryNumber || "______"}
                </span>
              </span>
            </p>
          </div>

          {/* Holographic seal */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              padding: "0 10px",
            }}
          >
            <BRCSeal />
            <p
              style={{
                fontFamily: "var(--font-cinzel), serif",
                fontSize: "8.5px",
                letterSpacing: "0.24em",
                color: COLORS.navy,
                fontWeight: 600,
                margin: 0,
              }}
            >
              PROTOCOLO DIGITAL REAL ESTATE
            </p>
          </div>

          {/* Right signature */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                borderTop: `1px solid ${COLORS.navy}`,
                marginBottom: "4px",
              }}
            />
            <p
              style={{
                fontSize: "11px",
                color: COLORS.navy,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Número de certificación notarial
            </p>
          </div>
        </div>

        {/* ---------- Cert number ---------- */}
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <div
            style={{
              borderTop: `1px solid ${COLORS.navy}`,
              width: "70%",
              margin: "0 auto 4px",
            }}
          />
          <p
            style={{
              fontSize: "11px",
              color: COLORS.navy,
              margin: 0,
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              letterSpacing: "0.08em",
            }}
          >
            Número de certificado BRC: {certNumber}
          </p>
        </div>

        {/* ---------- Bottom microprint ---------- */}
        <div
          style={{
            borderTop: `1px solid ${COLORS.gold}`,
            marginTop: "auto",
            paddingTop: "8px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: "7.5px",
              letterSpacing: "0.18em",
              color: COLORS.forest,
              textAlign: "center",
              margin: 0,
            }}
          >
            DOCUMENTO DE SEGURIDAD • VERIFICABLE • SUJETO A AUTENTICACIÓN POR BITHAUSS • PROHIBIDA SU REPRODUCCIÓN NO AUTORIZADA
          </p>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Field row helpers                                                  */
/* ------------------------------------------------------------------ */

function FieldRow({
  label,
  suffix,
  widthPct = 100,
}: {
  label: string;
  suffix?: string;
  widthPct?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "6px",
        fontSize: "12px",
        color: COLORS.navy,
        marginTop: "10px",
        marginBottom: "2px",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          flex: widthPct === 100 ? 1 : `0 0 ${widthPct}%`,
          borderBottom: `1px solid ${COLORS.navy}`,
          height: "1em",
        }}
      />
      {suffix && (
        <span style={{ marginLeft: "4px", fontSize: "12px" }}>{suffix}</span>
      )}
    </div>
  );
}

function FieldFill({ width, value }: { width: string; value?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width,
        borderBottom: `1px solid ${COLORS.navy}`,
        textAlign: "center",
        fontFamily: "var(--font-playfair), serif",
        fontSize: "12px",
        color: COLORS.navy,
        lineHeight: 1.2,
        textTransform: "capitalize",
      }}
    >
      {value || " "}
    </span>
  );
}
