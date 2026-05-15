"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Document types for testing                                         */
/* ------------------------------------------------------------------ */

const TEST_DOCUMENT_TYPES = [
  { slug: "escritura_propiedad", name: "Escritura de Propiedad del Inmueble a Certificar" },
  { slug: "folio_real", name: "Folio Real del Inmueble (Constancia de Inscripción en el RPP)" },
  { slug: "resolucion_judicial", name: "Resolución Judicial" },
  { slug: "ultima_boleta_predial", name: "Última Boleta Predial del Inmueble" },
  { slug: "ultima_boleta_agua", name: "Última Boleta de Agua del Inmueble" },
  { slug: "uso_de_suelo", name: "Constancia de Uso de Suelo autorizado del Inmueble" },
  { slug: "no_adeudo_mantenimiento", name: "Constancia de No Adeudo de Cuotas de Mantenimiento" },
  { slug: "regimen_condominio", name: "Escritura de Régimen de Propiedad en Condominio" },
  { slug: "identificacion_propietario", name: "Identificación del Propietario" },
  { slug: "acta_matrimonio", name: "Acta de Matrimonio del Propietario" },
  { slug: "comprobante_domicilio", name: "Comprobante de Domicilio con la dirección del Inmueble" },
  { slug: "poder_notarial", name: "Poder Notarial para actos de Administración" },
];

/* ------------------------------------------------------------------ */
/*  Highlighted "key" fields per document type                         */
/* ------------------------------------------------------------------ */

const KEY_FIELDS: Record<string, string[]> = {
  escritura_propiedad: ["nombrePropietario", "direccionInmueble", "fechaEscritura"],
  folio_real: ["folioReal", "nombrePropietario", "fechaInscripcion"],
  resolucion_judicial: ["actor", "demandado", "fechaResolucion"],
  ultima_boleta_predial: ["nombrePropietario", "montoPagado", "fechaPago"],
  ultima_boleta_agua: ["nombreTitular", "montoPagado", "fechaPago"],
  uso_de_suelo: ["usoAutorizado", "direccionInmueble", "vigencia"],
  no_adeudo_mantenimiento: ["nombrePropietario", "estatusAdeudo", "fechaEmision"],
  regimen_condominio: ["nombreCondominio", "ubicacion", "fechaEscritura"],
  identificacion_propietario: ["nombreCompleto", "vigencia", "domicilio"],
  acta_matrimonio: ["contrayente1", "contrayente2", "fechaMatrimonio"],
  comprobante_domicilio: ["nombreTitular", "direccion", "fechaEmision"],
  poder_notarial: ["otorgante", "apoderado", "fechaOtorgamiento"],
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StandaloneCheck {
  rule: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
}

interface OcrResult {
  valid: boolean;
  confidence: string;
  detectedType: string;
  expectedType: string;
  message: string;
  extractedData: Record<string, unknown>;
  standaloneChecks?: StandaloneCheck[];
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

const SPANISH_MONTHS: Record<string, number> = {
  ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5,
  JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11,
};

function tryParseDate(value: string): Date | null {
  // ISO: 2024-09-18 or 2024-09-18T10:00:00
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // dd-MMM-yyyy or dd/MMM/yyyy (Spanish abbrev): 18-SEP-2024
  const spanishMatch = value.match(/^(\d{1,2})[-/]([A-Za-zÁÉÍÓÚáéíóú]+)[-/](\d{2,4})$/);
  if (spanishMatch && spanishMatch[1] && spanishMatch[2] && spanishMatch[3]) {
    const [, day, monthStr, yearStr] = spanishMatch;
    const month = SPANISH_MONTHS[monthStr.toUpperCase().substring(0, 3)];
    if (month != null) {
      const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
      return new Date(year, month, Number(day));
    }
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const numericMatch = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numericMatch && numericMatch[1] && numericMatch[2] && numericMatch[3]) {
    const [, day, month, yearStr] = numericMatch;
    const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
    return new Date(year, Number(month) - 1, Number(day));
  }
  return null;
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-MX");

function formatValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";

  // Money fields
  if (typeof value === "number" && /monto|valor|costo|cuotamensual|importe|pago/i.test(key)) {
    return moneyFormatter.format(value);
  }

  // Generic numbers (consumo, superficie, etc.)
  if (typeof value === "number") {
    return numberFormatter.format(value);
  }

  // Date fields
  if (typeof value === "string" && /fecha|vigencia|periodo/i.test(key)) {
    const date = tryParseDate(value);
    if (date && !isNaN(date.getTime())) return dateFormatter.format(date);
  }

  return String(value);
}

function flattenData(data: Record<string, unknown>): [string, unknown][] {
  const flattened: [string, unknown][] = [];
  for (const [key, val] of Object.entries(data)) {
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      Object.keys(val as Record<string, unknown>).length > 3
    ) {
      for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
        flattened.push([subKey, subVal]);
      }
    } else {
      flattened.push([key, val]);
    }
  }
  return flattened.filter(([k]) => k !== "tipoDocumento" && k !== "tipo_documento");
}

/* ------------------------------------------------------------------ */
/*  Renderers                                                          */
/* ------------------------------------------------------------------ */

function KeyFieldCard({ keyName, value }: { keyName: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-50/40 p-4">
      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
        {formatLabel(keyName)}
      </p>
      <p className="mt-1 text-base font-semibold text-gray-900 leading-tight break-words">
        {formatValue(keyName, value)}
      </p>
    </div>
  );
}

function SimpleField({ keyName, value }: { keyName: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        {formatLabel(keyName)}
      </p>
      <p className="mt-0.5 text-sm font-medium text-gray-900 break-words">
        {formatValue(keyName, value)}
      </p>
    </div>
  );
}

function ArrayField({ keyName, value }: { keyName: string; value: unknown[] }) {
  return (
    <div className="col-span-full rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
        {formatLabel(keyName)}
      </p>
      <div className="flex flex-wrap gap-2">
        {value.map((item, idx) => (
          <span
            key={idx}
            className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
          >
            {typeof item === "object" && item !== null
              ? Object.values(item as Record<string, unknown>).join(" — ")
              : String(item)}
          </span>
        ))}
      </div>
    </div>
  );
}

function NestedObjectField({
  keyName,
  value,
}: {
  keyName: string;
  value: Record<string, unknown>;
}) {
  return (
    <div className="col-span-full rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        {formatLabel(keyName)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(value).map(([k, v]) => (
          <SimpleField key={k} keyName={k} value={v} />
        ))}
      </div>
    </div>
  );
}

function TextoExtraidoField({ value }: { value: string }) {
  return (
    <div className="col-span-full rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
        Texto Extraído del Documento
      </p>
      <div className="rounded-lg bg-gray-50 p-4 max-h-48 overflow-y-auto">
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
          {value}
        </p>
      </div>
    </div>
  );
}

function ExtractedDataView({
  data,
  slug,
}: {
  data: Record<string, unknown>;
  slug: string;
}) {
  const entries = flattenData(data);
  const keyFieldNames = new Set(KEY_FIELDS[slug] ?? []);

  const keyEntries: [string, unknown][] = [];
  const restEntries: [string, unknown][] = [];

  for (const [k, v] of entries) {
    if (keyFieldNames.has(k) && v != null && v !== "") {
      keyEntries.push([k, v]);
    } else {
      restEntries.push([k, v]);
    }
  }

  return (
    <div className="space-y-5">
      {keyEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {keyEntries.map(([k, v]) => (
            <KeyFieldCard key={k} keyName={k} value={v} />
          ))}
        </div>
      )}

      {restEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {restEntries.map(([k, v]) => {
            if (Array.isArray(v)) return <ArrayField key={k} keyName={k} value={v} />;
            if (typeof v === "object" && v !== null) {
              return (
                <NestedObjectField
                  key={k}
                  keyName={k}
                  value={v as Record<string, unknown>}
                />
              );
            }
            if (k === "textoExtraido" && typeof v === "string") {
              return <TextoExtraidoField key={k} value={v} />;
            }
            return <SimpleField key={k} keyName={k} value={v} />;
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Document preview pane                                              */
/* ------------------------------------------------------------------ */

function DocumentPreview({ file, url }: { file: File; url: string }) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png)$/i.test(file.name);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden lg:sticky lg:top-4">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <FileText className="h-4 w-4 text-gray-500" />
        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
      </div>
      {isPdf ? (
        <iframe
          src={url}
          title={file.name}
          className="block w-full h-[700px] bg-gray-50"
        />
      ) : isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="block w-full max-h-[700px] object-contain bg-gray-50" />
      ) : (
        <div className="p-8 text-center text-sm text-gray-500">
          Vista previa no disponible para este formato.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OcrTestPage() {
  const [selectedType, setSelectedType] = useState(
    TEST_DOCUMENT_TYPES[0]?.slug ?? "escritura_propiedad",
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && /\.(pdf|jpe?g|png)$/i.test(droppedFile.name)) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  }

  async function handleValidate() {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setElapsed(null);

    const start = Date.now();

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentSlug", selectedType);

      const res = await fetch("/api/v1/ocr/validate", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      setElapsed(Date.now() - start);

      if (!res.ok) {
        const text = await res.text();
        setError(`Error ${res.status}: ${text}`);
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setElapsed(Date.now() - start);
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const showSplitView = result && file && previewUrl;

  return (
    <div className={`mx-auto space-y-8 pb-12 ${showSplitView ? "max-w-7xl" : "max-w-4xl"}`}>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al Dashboard
      </Link>

      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Prueba de Validación OCR
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Sube un documento y selecciona el tipo esperado para probar la validación automática con Azure AI.
        </p>
      </div>

      {/* Test Form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipo de documento esperado
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          >
            {TEST_DOCUMENT_TYPES.map((dt) => (
              <option key={dt.slug} value={dt.slug}>
                {dt.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Documento a validar
          </label>
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <FileText className="h-5 w-5 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800 truncate">{file.name}</p>
                <p className="text-xs text-emerald-600">
                  {(file.size / 1024).toFixed(1)} KB — {file.type || "desconocido"}
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
                className="text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 transition-all ${
                dragging
                  ? "border-blue-400 bg-blue-50 scale-[1.01]"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className={`h-8 w-8 ${dragging ? "text-blue-400" : "text-gray-300"}`} />
              <div className="text-center">
                <p className={`text-sm font-semibold ${dragging ? "text-blue-600" : "text-gray-600"}`}>
                  {dragging ? "Suelta el archivo aquí" : "Arrastra un archivo o haz click para seleccionar"}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG o PNG — Max 50MB</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
              />
            </label>
          )}
        </div>

        <button
          onClick={handleValidate}
          disabled={!file || loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{
            background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando con Azure AI...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Validar Documento
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
            {elapsed != null && (
              <p className="text-xs text-red-500 mt-1">Tiempo: {(elapsed / 1000).toFixed(1)}s</p>
            )}
          </div>
        </div>
      )}

      {/* Result with split view */}
      {result && (
        <div className={`grid gap-6 ${showSplitView ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {showSplitView && file && previewUrl && (
            <DocumentPreview file={file} url={previewUrl} />
          )}

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div
              className="p-5 text-white"
              style={{
                background: result.valid
                  ? result.confidence === "high"
                    ? "linear-gradient(135deg, hsl(160 84% 39%), hsl(160 70% 30%))"
                    : "linear-gradient(135deg, hsl(45 93% 47%), hsl(30 90% 40%))"
                  : "linear-gradient(135deg, hsl(0 72% 51%), hsl(0 60% 40%))",
              }}
            >
              <div className="flex items-center gap-3">
                {result.valid ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : (
                  <AlertCircle className="h-8 w-8" />
                )}
                <div>
                  <h3 className="text-lg font-bold">
                    {result.valid ? "Documento Válido" : "Documento Rechazado"}
                  </h3>
                  <p className="text-sm opacity-80">{result.message}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Confianza</p>
                  <p className={`text-sm font-bold ${
                    result.confidence === "high" ? "text-emerald-600" :
                    result.confidence === "medium" ? "text-amber-600" : "text-red-600"
                  }`}>
                    {result.confidence === "high" ? "Alta" : result.confidence === "medium" ? "Media" : "Baja"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Tiempo</p>
                  <p className="text-sm font-bold text-gray-900">
                    {elapsed != null ? `${(elapsed / 1000).toFixed(1)}s` : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Tipo Detectado</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{result.detectedType}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Tipo Esperado</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{result.expectedType}</p>
                </div>
              </div>

              {result.standaloneChecks && result.standaloneChecks.length > 0 && (
                <div>
                  <h4
                    className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    Validaciones del documento
                  </h4>
                  <div className="space-y-2">
                    {result.standaloneChecks.map((c) => {
                      const cfg = {
                        pass: { bg: "bg-emerald-50", color: "text-emerald-600", icon: CheckCircle2, label: "OK" },
                        fail: { bg: "bg-red-50", color: "text-red-600", icon: AlertCircle, label: "Falla" },
                        warn: { bg: "bg-amber-50", color: "text-amber-600", icon: AlertCircle, label: "Atención" },
                        skip: { bg: "bg-gray-50", color: "text-gray-400", icon: AlertCircle, label: "Sin datos" },
                      }[c.status];
                      const Icon = cfg.icon;
                      return (
                        <div key={c.rule} className={`flex items-start gap-3 rounded-xl ${cfg.bg} p-3`}>
                          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900">{c.label}</p>
                            <p className="text-[11px] text-gray-700 mt-0.5 break-words">{c.message}</p>
                          </div>
                          <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.keys(result.extractedData).length > 0 && (
                <div>
                  <h4
                    className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    Datos Extraídos
                  </h4>
                  <ExtractedDataView data={result.extractedData} slug={selectedType} />
                </div>
              )}

              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                  Ver JSON crudo
                </summary>
                <pre className="mt-2 rounded-xl bg-gray-900 p-4 text-xs text-emerald-400 overflow-x-auto max-h-64">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
