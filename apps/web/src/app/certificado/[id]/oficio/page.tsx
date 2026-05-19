"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, AlertCircle, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import {
  computeSecurity,
  buildStegoWatermarkSvg,
  encodeFolioToZeroWidth,
  type CertData,
  type SecurityArtifacts,
} from "@/lib/cert-security";
import "./oficio-cert.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CertificateRecord {
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

function splitCertNumber(num: string) {
  const cleaned = (num || "").replace(/[^A-Z0-9-]/gi, "");
  if (cleaned.includes("-")) {
    const [serie, folio] = cleaned.split("-");
    return {
      serie: (serie || "AAA-000"),
      folio: (folio || "000000").padStart(6, "0"),
    };
  }
  return {
    serie: cleaned.slice(0, 7) || "AAA-000",
    folio: cleaned.slice(-6) || "000000",
  };
}

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric" });
}
function formatMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", { month: "long" });
}
function formatYearTwoDigits(dateStr: string) {
  return String(new Date(dateStr).getFullYear()).slice(-2);
}

/* ------------------------------------------------------------------ */
/*  Loading / empty states                                             */
/* ------------------------------------------------------------------ */

function CertificateSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-200 pt-[120px]">
      <div className="mx-auto flex max-w-3xl items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CertificadoOficioPage() {
  const params = useParams();
  const certificateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(1);

  const certRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);

  /* ------------ Fetch certificate + related entities ------------ */
  useEffect(() => {
    async function fetchCertificate() {
      if (!certificateId) return;

      const { data: certData, error: certError } = await supabase
        .from("brc_certificates")
        .select(
          "id, certificate_number, qr_code_url, pdf_url, issued_at, issued_by, expires_at, created_at, property_id, expediente_id",
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
            "id, title, address_line, city, state, price, currency, featured_image_url",
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
        ...(certData as unknown as CertificateRecord),
        properties: propertyData,
        brc_expedientes: expedienteData,
        issued_by_profile: issuedByProfile,
        notary_profile: notaryProfile,
      });
      setLoading(false);
    }

    fetchCertificate();
  }, [certificateId, supabase]);

  /* ------------ Responsive scaling to fit viewport ------------ */
  useEffect(() => {
    function updateScale() {
      if (!wrapperRef.current) return;
      const availableWidth = wrapperRef.current.offsetWidth;
      // Native width 215.9mm ≈ 816px @ 96dpi
      const nativeWidth = 816;
      setScale(Math.min(1, availableWidth / nativeWidth));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [loading]);

  /* ------------ PDF download ------------ */
  const handleDownload = useCallback(async () => {
    if (!certRef.current || downloading) return;
    setDownloading(true);
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Give QR + security strip a tick to settle.
      await new Promise((r) => setTimeout(r, 150));

      const canvas = await html2canvas(certRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#E8EDE5",
        logging: false,
        imageTimeout: 15000,
        windowWidth: certRef.current.scrollWidth,
        windowHeight: certRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [216, 356],
        compress: true,
      });
      pdf.addImage(imgData, "JPEG", 0, 0, 216, 356, undefined, "SLOW");
      const filename = `certificado-brc-${certificate?.certificate_number ?? "documento"}.pdf`;
      pdf.save(filename);
    } catch (err) {
      logError("Download error:", err);
    } finally {
      setDownloading(false);
    }
  }, [certificate, downloading]);

  if (loading) return <CertificateSkeleton />;

  if (!certificate) {
    return (
      <div className="min-h-screen bg-neutral-200 pt-[120px]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="mb-4 h-16 w-16 text-gray-300" />
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              Certificado no encontrado
            </h2>
            <p className="mb-6 max-w-md text-center text-sm text-gray-500">
              El certificado solicitado no existe o ha sido removido.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const property = certificate.properties ?? {
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
  const issuedDay = formatDay(certificate.issued_at);
  const issuedMonth = formatMonth(certificate.issued_at);
  const issuedYear = formatYearTwoDigits(certificate.issued_at);
  const issuedPlace = certificate.notary_profile?.notary_state || "____________";

  return (
    <div className="min-h-screen bg-neutral-300 pb-12 pt-[110px]">
      <div className="mx-auto max-w-[840px] px-4">
        <div className="mb-6 flex items-center justify-between">
          <Button asChild variant="ghost" className="rounded-xl text-gray-700 hover:bg-white/60">
            <Link href={property.id ? `/propiedades/${property.id}` : "/"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl px-5 text-white shadow-md"
            style={{ background: "linear-gradient(135deg, #1B2A4A, #2D4A3E)" }}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar certificado
              </>
            )}
          </Button>
        </div>

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
                certNumber={certificate.certificate_number}
                serie={serie}
                folio={folio}
                address={address}
                notaryName={notaryName}
                notaryNumber={notaryNumber}
                issuedPlace={issuedPlace}
                issuedDay={issuedDay}
                issuedMonth={issuedMonth}
                issuedYear={issuedYear}
                verifyUrl={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/certificado/${certificate.id}`
                    : `/certificado/${certificate.id}`
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Certificate document                                                */
/*  Native size: 215.9 × 355.6 mm                                       */
/* ------------------------------------------------------------------ */

interface CertificateDocumentProps {
  certNumber: string;
  serie: string;
  folio: string;
  address: string;
  notaryName: string;
  notaryNumber: string;
  issuedPlace: string;
  issuedDay: string;
  issuedMonth: string;
  issuedYear: string;
  verifyUrl: string;
}

const CertificateDocument = ({
  ref,
  certNumber,
  serie,
  folio,
  address,
  notaryName,
  notaryNumber,
  issuedPlace,
  issuedDay,
  issuedMonth,
  issuedYear,
  verifyUrl,
}: CertificateDocumentProps & { ref?: React.Ref<HTMLDivElement> }) => {
  const [security, setSecurity] = useState<SecurityArtifacts | null>(null);
  const [qrSrc, setQrSrc] = useState<string>("");

  const certData: CertData = useMemo(
    () => ({
      serie,
      folio,
      direccion: address,
      escritura: "",
      folioReal: "",
      supTerreno: "",
      supConstruida: "",
      lugar: issuedPlace,
      dia: issuedDay,
      mes: issuedMonth,
      anio: issuedYear,
      numCert: certNumber,
    }),
    [serie, folio, address, issuedPlace, issuedDay, issuedMonth, issuedYear, certNumber],
  );

  /* Compute the 13 security artifacts once data is bound */
  useEffect(() => {
    let cancelled = false;
    computeSecurity(certData)
      .then((s) => {
        if (!cancelled) setSecurity(s);
      })
      .catch((err) => logError("Security engine error", err));
    return () => {
      cancelled = true;
    };
  }, [certData]);

  /* Generate QR encoding the signed payload (falls back to verify URL until ready) */
  useEffect(() => {
    let cancelled = false;
    const dataForQr = security?.encodedPayload ?? verifyUrl;
    QRCode.toDataURL(dataForQr, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 240,
      color: { dark: "#1B2A4A", light: "#0000" },
    })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch((err) => logError("QR generation failed", err));
    return () => {
      cancelled = true;
    };
  }, [security, verifyUrl]);

  const checksum = security?.checksum ?? 0;
  const hashShort = security?.hash.slice(0, 24) ?? "";
  const timestamp = security?.timestamp ?? "";
  const folioWithChk = `${folio}-${checksum}`;

  /* Layered microprint texts (B1) and microframe sigil (B2) */
  const microprintText = `DOC-SEG · ${folioWithChk} · VERIFICABLE · BITHAUSS · ${folioWithChk} · NO REPRODUCIR · VERIFY.BITHAUSS.COM/${folioWithChk}`;
  const microFrameSigil = security
    ? `${("BRC · " + folio.slice(0, 12) + " · SHA256:" + security.hash.slice(0, 16) + " · " + timestamp.replace("T", " ").substr(0, 19) + " · BITHAUSS · ").repeat(12)}`
    : "";
  const securityStripText = security
    ? `SHA-256: ${hashShort} · TS: ${timestamp} · CHECKSUM: ${checksum} · BRC-VERIFIED`
    : "";

  /* E3 dynamic seal serial */
  const sealSerial = `BRC-${serie.replace(/[^A-Z0-9]/gi, "")}-${folio.replace(/[^A-Z0-9]/gi, "")}-${checksum}`;

  /* F2 zero-width binary mark prepended to address — invisible to humans */
  const addressWithZwMark = (security ? encodeFolioToZeroWidth(folioWithChk) : "") + address;

  /* E1 unique geometry — small per-folio variations */
  const wmStyles = useMemo(() => {
    if (!security) return [] as Array<React.CSSProperties>;
    const styles: Array<React.CSSProperties> = [];
    const rng = (() => {
      let state = security.seed;
      return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
    for (let i = 0; i < 5; i++) {
      const variation = (rng() - 0.5) * 4;
      const opacityVar = 0.1 + (rng() - 0.5) * 0.02;
      styles.push({
        transform: `rotate(${(-30 + variation).toFixed(2)}deg)`,
        opacity: opacityVar.toFixed(3),
      });
    }
    return styles;
  }, [security]);

  const stegoSvg = security ? buildStegoWatermarkSvg(security.seed) : "";

  return (
    <div ref={ref} className="cert-root">
      <article className="cert-page" aria-label="Certificado BRC de Validación Inmobiliaria">
        <div className="abs guilloche" aria-hidden />

        <div className="abs wm wm-1" aria-hidden style={wmStyles[0]}>BIEN RAÍZ CERTIFICADO</div>
        <div className="abs wm wm-2" aria-hidden style={wmStyles[1]}>CERTIFICADO BRC</div>
        <div className="abs wm wm-3" aria-hidden style={wmStyles[2]}>DOCUMENTO VALIDADO</div>
        <div className="abs wm wm-4" aria-hidden style={wmStyles[3]}>CERTIFICADO OFICIAL</div>
        <div className="abs wm wm-5" aria-hidden style={wmStyles[4]}>NO REPRODUCIR</div>

        <div className="abs side-text" aria-hidden>
          DOCUMENTO VÁLIDO ÚNICAMENTE DENTRO DEL ECOSISTEMA BITHAUSS. www.bithauss.com
        </div>

        <div className="abs serie">Serie: <span>{serie}</span></div>
        <div className="abs folio">
          Folio: <span>{folio}</span>
          {security && <span className="cs-tag">-{checksum}</span>}
        </div>

        <div className="abs doc-type">DOCUMENTO DE SEGURIDAD INMOBILIARIA</div>
        <h1 className="abs title-cert">CERTIFICADO</h1>
        <div className="abs title-subtitle">DE VALIDACIÓN INMOBILIARIA</div>
        <div className="abs tagline-rule-left" aria-hidden />
        <div className="abs tagline-rule-right" aria-hidden />
        <div className="abs tagline">INMUEBLE APTO PARA COMERCIALIZACIÓN</div>

        <p className="abs intro">Se hace constar que el inmueble ubicado en:</p>
        <div className="abs address">{addressWithZwMark}</div>

        <div className="abs field-row field-row-1">
          Con número de escritura pública: <span className="ln ln-long"></span>
        </div>
        <div className="abs field-row field-row-2">
          Inscrito en el Registro Público de la Propiedad bajo el folio Real No: <span className="ln ln-short"></span>
        </div>
        <div className="abs field-row field-row-3">
          Superficie total del terreno: <span className="ln ln-num"></span> m²
        </div>
        <div className="abs field-row field-row-4">
          Superficie construida: <span className="ln ln-num"></span> m²
        </div>

        <p className="abs validation-text">
          <b>BITHAUSS</b> certifica que el inmueble citado se encuentra debidamente
          inscrito en el Registro Público de la Propiedad y cumple con la totalidad
          de los requisitos legales y notariales aplicables para su comercialización
          dentro del territorio nacional.
        </p>

        <div className="abs check check-1">Se encuentra Libre de gravámenes, hipotecas y embargos</div>
        <div className="abs check check-2">Escrituras públicas debidamente inscritas</div>
        <div className="abs check check-3">Certificado de libertad de gravamen vigente</div>
        <div className="abs check check-4">Pagos de impuesto predial al corriente</div>
        <div className="abs check check-5">Alineamiento y número oficial</div>
        <div className="abs check check-6">Constancia de no adeudo de agua</div>
        <div className="abs check check-7">Identificación y legitimación del propietario verificada</div>

        <div className="abs qr-img" id="qr-target" role="img" aria-label="Código QR de verificación blockchain">
          {qrSrc && <img src={qrSrc} alt="QR" />}
        </div>
        <div className="abs bithauss-logo" role="img" aria-label="Logo BitHauss" />
        <div className="abs qr-caption">
          CERTIFICADO BRC<br />TOKENIZADO EN<br />LA BLOCKCHAIN
        </div>

        <div className="abs expedition-title">DATOS Y CONDICIONES DE EXPEDICIÓN</div>

        <div className="abs place-date">
          Lugar y fecha:&nbsp;
          <span className="ln ln-place">{issuedPlace}</span>, a{" "}
          <span className="ln ln-day">{issuedDay}</span> de{" "}
          <span className="ln ln-month">{issuedMonth}</span> de 20
          <span className="ln ln-year">{issuedYear}</span>
        </div>

        <p className="abs vigencia">
          El presente <b>Certificado BRC</b> mantendrá su vigencia por un periodo de{" "}
          <b>90 días</b> a partir de la fecha de expedición. Su autenticidad puede ser
          verificada en todo momento mediante el código QR impreso en el presente
          documento, el cual referencia el registro inmutable correspondiente en la
          red blockchain de <b>BitHauss</b>.
        </p>

        <div className="abs sig-line-left">{notaryName}</div>
        <div className="abs sig-line-right">{notaryNumber}</div>
        <div className="abs sig-left-label">Notario Público</div>
        <div className="abs sig-left-sub">Notaría No. <span>{notaryNumber || "________"}</span></div>
        <div className="abs sig-right-label">Número de certificación notarial</div>

        <div className="abs seal-wrapper" role="img" aria-label="Sello holográfico BRC">
          <div className="seal-img-bg" />
          <svg className="seal-serial-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <defs>
              <path id="seal-arc-top" d="M 17,50 A 33,33 0 0 1 83,50" fill="none" />
              <path id="seal-arc-bottom" d="M 17,50 A 33,33 0 0 0 83,50" fill="none" />
            </defs>
            <text className="seal-serial-text" transform="translate(0, 2)">
              <textPath href="#seal-arc-bottom" startOffset="50%" textAnchor="middle">
                {sealSerial}
              </textPath>
            </text>
          </svg>
        </div>
        <div className="abs protocolo">PROTOCOLO DIGITAL REAL ESTATE</div>

        <div className="abs cert-num-label">Número de certificado BRC</div>
        <div className="abs cert-num-fill">{certNumber}</div>

        <div className="abs gold-line-1" aria-hidden />
        <div className="abs gold-line-2" aria-hidden />

        <div className="abs microprint" aria-hidden>{microprintText}</div>

        {/* Security layers */}
        <div className="abs screen-pattern" aria-hidden />
        <div
          className="abs stego-watermark"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: stegoSvg }}
        />
        <div className="abs void-pattern" aria-hidden />
        <div className="abs rainbow-strip" aria-hidden />
        <div className="abs rainbow-strip-bottom" aria-hidden />

        <div className="abs micro-frame micro-frame-top" aria-hidden>{microFrameSigil}</div>
        <div className="abs micro-frame micro-frame-bottom" aria-hidden>{microFrameSigil}</div>
        <div className="abs micro-frame micro-frame-left" aria-hidden>{microFrameSigil}</div>
        <div className="abs micro-frame micro-frame-right" aria-hidden>{microFrameSigil}</div>

        <div className="abs security-strip" aria-hidden>{securityStripText}</div>
      </article>
    </div>
  );
};
