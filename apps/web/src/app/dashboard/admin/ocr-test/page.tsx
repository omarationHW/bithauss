"use client";

import { useState } from "react";
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
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OcrResult {
  valid: boolean;
  confidence: string;
  detectedType: string;
  expectedType: string;
  message: string;
  extractedData: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Helper: format camelCase/snake_case to readable label              */
/* ------------------------------------------------------------------ */

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Recursive data renderer                                            */
/* ------------------------------------------------------------------ */

function DataRenderer({ data }: { data: Record<string, unknown> }) {
  // Flatten: if there's a wrapper object like "informacionRelevante"
  // that contains most of the data, render its contents directly
  const entries = Object.entries(data);
  const flattened: [string, unknown][] = [];

  for (const [key, val] of entries) {
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      Object.keys(val as Record<string, unknown>).length > 3
    ) {
      // This is a wrapper object — flatten its contents
      for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
        flattened.push([subKey, subVal]);
      }
    } else {
      flattened.push([key, val]);
    }
  }

  // Filter out the generic tipoDocumento from Azure — we already show it in the header
  const filtered = flattened.filter(([key]) => key !== "tipoDocumento" && key !== "tipo_documento");

  return (
    <>
      {filtered.map(([key, val]) => {
        const label = formatLabel(key);

        // Array of objects
        if (Array.isArray(val)) {
          return (
            <div key={key} className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
              <div className="space-y-2">
                {val.map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-gray-50 p-3">
                    {typeof item === "object" && item !== null ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-[10px] text-gray-400 uppercase">{formatLabel(k)}</p>
                            <p className="text-sm font-medium text-gray-900">{String(v ?? "—")}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-900">{String(item)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Object with few keys (e.g. lugarMatrimonio)
        if (typeof val === "object" && val !== null) {
          return (
            <div key={key} className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(val as Record<string, unknown>).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-gray-400 uppercase">{formatLabel(k)}</p>
                    <p className="text-sm font-medium text-gray-900">{String(v ?? "—")}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Extracted text block — show as formatted document preview
        if (key === "textoExtraido" && typeof val === "string") {
          return (
            <div key={key} className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Texto Extraído del Documento</p>
              <div className="rounded-lg bg-gray-50 p-4 max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">{val}</p>
              </div>
            </div>
          );
        }

        // Simple value
        return (
          <div key={key} className="flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{String(val ?? "—")}</p>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OcrTestPage() {
  const [selectedType, setSelectedType] = useState(TEST_DOCUMENT_TYPES[0].slug);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

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

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Admin
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
        {/* Document Type Selector */}
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

        {/* File Upload */}
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
                  {(file.size / 1024).toFixed(1)} KB — {file.type}
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

        {/* Validate Button */}
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

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Result Header */}
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

          {/* Result Details */}
          <div className="p-6 space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <p className="text-[10px] text-gray-400 uppercase font-bold">Tipo Detectado</p>
                <p className="text-sm font-bold text-gray-900 truncate">{result.detectedType}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Tipo Esperado</p>
                <p className="text-sm font-bold text-gray-900 truncate">{result.expectedType}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Tiempo</p>
                <p className="text-sm font-bold text-gray-900">
                  {elapsed != null ? `${(elapsed / 1000).toFixed(1)}s` : "—"}
                </p>
              </div>
            </div>

            {/* Extracted Data */}
            {Object.keys(result.extractedData).length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Datos Extraídos
                </h4>
                <div className="space-y-3">
                  <DataRenderer data={result.extractedData} />
                </div>
              </div>
            )}

            {/* Raw JSON */}
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
      )}
    </div>
  );
}
