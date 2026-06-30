"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OcrStandaloneCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface OcrReviewDocument {
  id: string;
  ocr_detected_type: string | null;
  ocr_confidence: string | null;
  ocr_valid: boolean | null;
  ocr_extracted_data: Record<string, unknown> | null;
  ocr_corrected_data: Record<string, unknown> | null;
  ocr_standalone_checks: OcrStandaloneCheck[] | null;
}

interface OcrDocumentReviewProps {
  doc: OcrReviewDocument;
  /** Human-readable expected document type (e.g. brc_document_types.name) */
  expectedType: string;
  isNotario: boolean;
  /** Called after a successful correction so the parent can refresh state. */
  onCorrected: (docId: string, correctedData: Record<string, unknown>) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** "fechaEmision" / "fecha_emision" -> "Fecha Emision" */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render any extracted value as a readable string. */
function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        typeof x === "object" && x !== null
          ? Object.values(x as Record<string, unknown>)
              .filter(Boolean)
              .join(" — ")
          : String(x),
      )
      .join(", ");
  }
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>)
      .filter(Boolean)
      .join(" ");
  }
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

/** Scalars can be edited inline; objects/arrays are preserved untouched. */
function isScalar(v: unknown): v is string | number | boolean {
  return (
    v == null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

const HIDDEN_KEYS = new Set(["textoExtraido", "texto_extraido"]);

const confidenceLabel: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const confidenceBadgeStyle: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-red-50 text-red-700 border border-red-200",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OcrDocumentReview({
  doc,
  expectedType,
  isNotario,
  onCorrected,
}: OcrDocumentReviewProps) {
  const supabase = useMemo(() => createClient(), []);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const extracted = doc.ocr_extracted_data ?? {};
  const corrected = doc.ocr_corrected_data;
  const hasCorrection =
    corrected != null && Object.keys(corrected).length > 0;

  /** Base data shown / edited: corrected overrides extracted. */
  const baseData = useMemo<Record<string, unknown>>(
    () => (hasCorrection ? (corrected as Record<string, unknown>) : extracted),
    [hasCorrection, corrected, extracted],
  );

  const visibleEntries = useMemo(
    () => Object.entries(baseData).filter(([k]) => !HIDDEN_KEYS.has(k)),
    [baseData],
  );

  const hasData = visibleEntries.length > 0;
  const checks = doc.ocr_standalone_checks ?? [];

  /** Detected type mismatch with the expected slot. */
  const detected = doc.ocr_detected_type?.trim() ?? "";
  const typeMismatch =
    detected.length > 0 &&
    expectedType.trim().length > 0 &&
    detected.toLowerCase() !== expectedType.trim().toLowerCase();

  function startEditing() {
    const initial: Record<string, string> = {};
    for (const [k, v] of visibleEntries) {
      if (isScalar(v)) initial[k] = v == null ? "" : String(v);
    }
    setDraft(initial);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
    setDraft({});
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Merge edited scalar fields back over the base object, preserving
    // non-scalar fields and original numeric/boolean types when possible.
    const correctedData: Record<string, unknown> = { ...baseData };
    for (const [k, v] of Object.entries(draft)) {
      const original = baseData[k];
      if (typeof original === "number") {
        const n = Number(v);
        correctedData[k] = v.trim() !== "" && !Number.isNaN(n) ? n : v;
      } else if (typeof original === "boolean") {
        correctedData[k] = v === "true" || v === "Sí" || v === "true";
      } else {
        correctedData[k] = v;
      }
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(
        `${apiBase}/api/v1/brc/documents/${doc.id}/ocr-correction`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ corrected_data: correctedData }),
        },
      );

      if (!res.ok) {
        throw new Error(`No se pudo guardar la corrección (${res.status})`);
      }

      onCorrected(doc.id, correctedData);
      setEditing(false);
      setDraft({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // Nothing to show at all.
  if (!hasData && checks.length === 0 && !detected) return null;

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* ---- Type + confidence badges ---- */}
      <div className="flex flex-wrap items-center gap-1">
        {doc.ocr_confidence && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              confidenceBadgeStyle[doc.ocr_confidence] ??
              "bg-gray-50 text-gray-600 border border-gray-200"
            }`}
          >
            OCR {confidenceLabel[doc.ocr_confidence] ?? doc.ocr_confidence}
          </span>
        )}
        {detected && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
              typeMismatch
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-gray-50 text-gray-600 border border-gray-200"
            }`}
            title={
              typeMismatch
                ? `Tipo detectado distinto al esperado (${expectedType})`
                : undefined
            }
          >
            {typeMismatch ? "≠ " : ""}Detectado: {humanizeKey(detected)}
          </span>
        )}
      </div>

      {/* ---- Standalone checks ---- */}
      {checks.length > 0 && (
        <ul className="space-y-0.5">
          {checks.map((c, i) => (
            <li
              key={`${c.label}-${i}`}
              className="flex items-start gap-1 text-[10px] leading-tight"
              title={c.detail || undefined}
            >
              {c.passed ? (
                <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-px h-3 w-3 shrink-0 text-red-500" />
              )}
              <span className={c.passed ? "text-gray-700" : "text-red-700"}>
                {c.label}
                {c.detail && (
                  <span className="block text-[9px] text-gray-400">
                    {c.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Extracted / corrected data ---- */}
      {hasData && (
        <details className="group" open={editing}>
          <summary className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-700">
            {hasCorrection ? "Datos (corregidos)" : "Ver datos extraídos"}
            {hasCorrection && (
              <span className="rounded bg-blue-50 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-blue-600 border border-blue-200">
                Corregido
              </span>
            )}
          </summary>

          {!editing ? (
            <>
              <div className="mt-1 grid grid-cols-1 gap-1.5 rounded-md bg-gray-50 p-2 sm:grid-cols-2">
                {visibleEntries.map(([k, v]) => {
                  const wasCorrected =
                    hasCorrection &&
                    formatValue(v) !== formatValue(extracted[k]);
                  return (
                    <div key={k} className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        {humanizeKey(k)}
                      </p>
                      <p
                        className={`text-[10px] font-medium break-words ${
                          wasCorrected ? "text-blue-700" : "text-gray-900"
                        }`}
                      >
                        {formatValue(v)}
                        {wasCorrected && (
                          <span className="ml-1 text-[8px] font-bold uppercase text-blue-500">
                            corregido
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>

              {hasCorrection && (
                <p className="mt-1 text-[9px] italic text-blue-500">
                  Corregido por notario
                </p>
              )}

              {isNotario && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 transition-all hover:bg-blue-100"
                >
                  <Pencil className="h-3 w-3" />
                  Corregir datos
                </button>
              )}
            </>
          ) : (
            /* ---- Inline edit form ---- */
            <div className="mt-1 space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleEntries.map(([k, v]) => {
                  const editable = isScalar(v);
                  const fieldId = `ocr-${doc.id}-${k}`;
                  return (
                    <div key={k} className="min-w-0">
                      <label
                        htmlFor={fieldId}
                        className="block text-[9px] font-bold uppercase tracking-wider text-gray-400"
                      >
                        {humanizeKey(k)}
                      </label>
                      {editable ? (
                        <input
                          id={fieldId}
                          type="text"
                          value={draft[k] ?? ""}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [k]: e.target.value,
                            }))
                          }
                          disabled={saving}
                          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-900 outline-none transition-all focus:border-blue-300 focus:ring-1 focus:ring-blue-100 disabled:opacity-50"
                        />
                      ) : (
                        <p
                          className="text-[10px] font-medium text-gray-500 break-words"
                          aria-label={humanizeKey(k)}
                        >
                          {formatValue(v)}
                          <span className="ml-1 text-[8px] uppercase text-gray-400">
                            (no editable)
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <p className="text-[10px] font-semibold text-red-600">{error}</p>
              )}

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
