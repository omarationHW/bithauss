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
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ShieldBrc } from '@/components/ui/shield-brc'

/* ------------------------------------------------------------------ */
/*  Document slots                                                     */
/* ------------------------------------------------------------------ */

interface DocSlot {
  key: string;                    // payload key for the cross-check API
  slug: string;                   // OCR slug for /validate endpoint
  title: string;
  description: string;
  required: boolean;
}

const DOC_SLOTS: DocSlot[] = [
  {
    key: "escritura",
    slug: "escritura_propiedad",
    title: "Escritura de Propiedad",
    description: "Documento principal con datos del comprador, vendedor, inmueble, precio, m² y referencias cruzadas.",
    required: true,
  },
  {
    key: "identificacion",
    slug: "identificacion_propietario",
    title: "INE / Pasaporte del propietario",
    description: "Para validar nombre, CURP, RFC y vigencia contra la escritura.",
    required: false,
  },
  {
    key: "actaMatrimonio",
    slug: "acta_matrimonio",
    title: "Acta de matrimonio del propietario",
    description: "Solo si el propietario declaró estado civil casado.",
    required: false,
  },
  {
    key: "folioReal",
    slug: "folio_real",
    title: "Folio Real / Constancia de inscripción RPP",
    description: "Para validar que el Folio Real coincide con la escritura.",
    required: false,
  },
  {
    key: "certificadoLibertadGravamen",
    slug: "folio_real",
    title: "Certificado de Libertad de Gravamen",
    description: "Para verificación adicional del Folio Real.",
    required: false,
  },
  {
    key: "boletaPredial",
    slug: "ultima_boleta_predial",
    title: "Boleta predial",
    description: "Cuenta predial, domicilio, m², valores. No mayor a 3 meses.",
    required: false,
  },
  {
    key: "boletaAgua",
    slug: "ultima_boleta_agua",
    title: "Boleta de agua",
    description: "Cuenta de agua, domicilio. No mayor a 3 meses.",
    required: false,
  },
  {
    key: "escrituraAntecedente",
    slug: "escritura_propiedad",
    title: "Escritura antecedente (opcional)",
    description: "Solo si la escritura principal referencia una escritura previa en antecedentes.",
    required: false,
  },
];

interface ProcessedDoc {
  file: File;
  status: "idle" | "processing" | "done" | "error";
  data?: Record<string, unknown>;
  error?: string;
  elapsed?: number;
}

interface CheckItem {
  rule: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
}

interface CrossCheckResult {
  checks: CheckItem[];
  summary: { pass: number; fail: number; warn: number; skip: number };
}

/* ------------------------------------------------------------------ */
/*  Slot card                                                          */
/* ------------------------------------------------------------------ */

function SlotCard({
  slot,
  state,
  onFile,
  onProcess,
  onClear,
}: {
  slot: DocSlot;
  state: ProcessedDoc | undefined;
  onFile: (f: File) => void;
  onProcess: () => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">
            {slot.title}
            {slot.required && <span className="ml-2 text-xs font-bold text-red-600">requerido</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{slot.description}</p>
        </div>
        {state?.status === "done" && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Procesado
          </span>
        )}
        {state?.status === "processing" && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando
          </span>
        )}
        {state?.status === "error" && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <AlertCircle className="h-3.5 w-3.5" /> Error
          </span>
        )}
      </div>

      {!state ? (
        <label
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-all ${
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f && /\.(pdf|jpe?g|png)$/i.test(f.name)) onFile(f);
          }}
        >
          <Upload className={`h-6 w-6 ${dragging ? "text-blue-400" : "text-gray-300"}`} />
          <p className="text-xs text-gray-600">
            {dragging ? "Suelta el archivo aquí" : "Arrastra o haz click — PDF / JPG / PNG"}
          </p>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{state.file.name}</p>
              <p className="text-[10px] text-gray-500">
                {(state.file.size / 1024).toFixed(1)} KB
                {state.elapsed != null && ` — ${(state.elapsed / 1000).toFixed(1)}s`}
              </p>
            </div>
            <button onClick={onClear} className="text-gray-400 hover:text-gray-700 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {state.status === "idle" && (
            <button
              onClick={onProcess}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
            >
              <ShieldBrc className="h-3.5 w-3.5" /> Procesar con OCR
            </button>
          )}

          {state.status === "error" && (
            <p className="text-xs text-red-600 px-1">{state.error}</p>
          )}

          {state.status === "done" && state.data && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-gray-600">
                Ver datos extraídos
              </summary>
              <pre className="mt-2 rounded-lg bg-gray-900 p-3 text-[10px] text-emerald-400 overflow-x-auto max-h-40">
                {JSON.stringify(state.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Check row                                                          */
/* ------------------------------------------------------------------ */

function CheckRow({ check }: { check: CheckItem }) {
  const config = {
    pass: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "OK" },
    fail: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Falla" },
    warn: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Atención" },
    skip: { icon: MinusCircle, color: "text-gray-400", bg: "bg-gray-50", label: "Sin datos" },
  }[check.status];
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 rounded-xl ${config.bg} p-4`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{check.label}</p>
        <p className="text-xs text-gray-700 mt-1 break-words">{check.message}</p>
      </div>
      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OcrEscrituraPage() {
  const [docs, setDocs] = useState<Record<string, ProcessedDoc>>({});
  const [crossCheck, setCrossCheck] = useState<CrossCheckResult | null>(null);
  const [crossLoading, setCrossLoading] = useState(false);
  const [crossError, setCrossError] = useState<string | null>(null);

  function setDoc(key: string, value: ProcessedDoc | undefined) {
    setDocs((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setCrossCheck(null);
  }

  async function processDoc(slot: DocSlot) {
    const current = docs[slot.key];
    if (!current) return;

    setDoc(slot.key, { ...current, status: "processing", error: undefined });
    const start = Date.now();

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append("file", current.file);
      formData.append("documentSlug", slot.slug);

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/v1/ocr/validate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const elapsed = Date.now() - start;

      if (!res.ok) {
        const text = await res.text();
        setDoc(slot.key, { ...current, status: "error", error: `Error ${res.status}: ${text}`, elapsed });
        return;
      }

      const result = await res.json();
      setDoc(slot.key, {
        ...current,
        status: "done",
        data: (result.extractedData as Record<string, unknown>) ?? {},
        elapsed,
      });
    } catch (err) {
      setDoc(slot.key, {
        ...current,
        status: "error",
        error: err instanceof Error ? err.message : "Error de conexión",
        elapsed: Date.now() - start,
      });
    }
  }

  async function runCrossCheck() {
    setCrossLoading(true);
    setCrossError(null);
    setCrossCheck(null);

    const payload: Record<string, unknown> = {};
    for (const slot of DOC_SLOTS) {
      const d = docs[slot.key];
      if (d?.status === "done" && d.data) {
        payload[slot.key] = d.data;
      }
    }

    if (!payload.escritura) {
      setCrossError("Falta procesar la Escritura de Propiedad.");
      setCrossLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/v1/ocr/cross-check-escritura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        setCrossError(`Error ${res.status}: ${text}`);
        return;
      }

      setCrossCheck(await res.json());
    } catch (err) {
      setCrossError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setCrossLoading(false);
    }
  }

  const escrituraReady = docs.escritura?.status === "done";
  const processedCount = Object.values(docs).filter((d) => d.status === "done").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
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
          Validación cruzada — Escritura de Propiedad
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Sube los documentos que tengas. La Escritura es obligatoria. Los demás opcionales — las reglas que dependan de docs faltantes se marcarán como &quot;Sin datos&quot;.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DOC_SLOTS.map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            state={docs[slot.key]}
            onFile={(file) => setDoc(slot.key, { file, status: "idle" })}
            onProcess={() => processDoc(slot)}
            onClear={() => setDoc(slot.key, undefined)}
          />
        ))}
      </div>

      <div className="sticky bottom-4 z-10">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-lg p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500">
              {processedCount} documento(s) procesado(s)
            </p>
          </div>
          <button
            onClick={runCrossCheck}
            disabled={!escrituraReady || crossLoading}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
          >
            {crossLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Validando coherencia...
              </>
            ) : (
              <>
                <ShieldBrc className="h-4 w-4" /> Validar coherencia
              </>
            )}
          </button>
        </div>
      </div>

      {crossError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-800">{crossError}</p>
        </div>
      )}

      {crossCheck && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{crossCheck.summary.pass}</p>
              <p className="text-[10px] uppercase font-bold text-emerald-600">Cumple</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{crossCheck.summary.fail}</p>
              <p className="text-[10px] uppercase font-bold text-red-600">Falla</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{crossCheck.summary.warn}</p>
              <p className="text-[10px] uppercase font-bold text-amber-600">Atención</p>
            </div>
            <div className="rounded-xl bg-gray-100 p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{crossCheck.summary.skip}</p>
              <p className="text-[10px] uppercase font-bold text-gray-500">Sin datos</p>
            </div>
          </div>

          <div className="space-y-2">
            {crossCheck.checks.map((c) => (
              <CheckRow key={c.rule} check={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
