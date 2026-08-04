"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileText,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { isDocumentRequired } from "@/lib/brc-documents";
import { useUser } from "@/app/dashboard/_context/user-context";
import { ShieldBrc } from '@/components/ui/shield-brc'
import { BrcExclusionNotice } from '@/components/ui/brc-exclusion-notice'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Property {
  id: string;
  title: string;
  address_line: string;
  city: string;
  state: string;
  price: number;
  currency: string;
  brc_status: string;
  type: string | null;
  operation: string | null;
}

interface BrcTariff {
  id: string;
  name: string;
  price_min: number;
  price_max: number | null;
  tariff_amount: number;
  currency: string;
}

/** A document already stored in the draft expediente. */
interface SavedDoc {
  id: string;
  file_name: string;
  file_url: string;
}

interface BrcDocumentType {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  allows_multiple: boolean;
  sort_order: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number, currency: string = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SolicitarBrcPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const id = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [tariff, setTariff] = useState<BrcTariff | null>(null);
  const [documentTypes, setDocumentTypes] = useState<BrcDocumentType[]>([]);
  /** Files picked but not yet uploaded, per document type. Requirements
   *  flagged `allows_multiple` can hold several (one ID per co-owner). */
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [validatingDocId, setValidatingDocId] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<Record<string, { valid: boolean; confidence: string; message: string; detectedType: string; extractedData: Record<string, unknown>; standaloneChecks?: Array<{ rule: string; label: string; status: string; message: string }> }>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Draft expediente for this property, created on first save. */
  const [draftId, setDraftId] = useState<string | null>(null);
  /** Documents already persisted in the draft, keyed by document_type_id. */
  const [savedDocs, setSavedDocs] = useState<Record<string, SavedDoc[]>>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* ---- Fetch property, tariff and document types ---- */
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        // Fetch property
        const { data: prop, error: propError } = await supabase
          .from("properties")
          .select("id, title, address_line, city, state, price, currency, brc_status, type, operation")
          .eq("id", id)
          .single();

        if (propError || !prop) {
          setError("No se encontro la propiedad.");
          setLoading(false);
          return;
        }

        setProperty(prop);

        // Fetch matching tariff
        const { data: tariffs } = await supabase
          .from("brc_tariffs")
          .select("*")
          .lte("price_min", prop.price)
          .order("price_min", { ascending: false });

        if (tariffs && tariffs.length > 0) {
          // Find the tariff where price_max >= property price OR price_max is null
          const matched = tariffs.find(
            (t: BrcTariff) => t.price_max === null || t.price_max >= prop.price
          );
          if (matched) setTariff(matched);
        }

        // Fetch document types
        const { data: docTypes } = await supabase
          .from("brc_document_types")
          .select("*")
          .order("sort_order", { ascending: true });

        if (docTypes) setDocumentTypes(docTypes);

        // Resume an unsent request, if any. Documents already uploaded show
        // as saved so the owner only has to add what is still missing.
        const { data: draft } = await supabase
          .from("brc_expedientes")
          .select("id, notes")
          .eq("property_id", id)
          .eq("status", "BORRADOR")
          .maybeSingle();

        if (draft) {
          setDraftId(draft.id as string);
          if (draft.notes) setNotes(draft.notes as string);

          const { data: docs } = await supabase
            .from("brc_documents")
            .select("id, document_type_id, file_name, file_url")
            .eq("expediente_id", draft.id);

          if (docs) {
            const grouped: Record<string, SavedDoc[]> = {};
            for (const d of docs) {
              const key = d.document_type_id as string;
              (grouped[key] ??= []).push({
                id: d.id as string,
                file_name: d.file_name as string,
                file_url: d.file_url as string,
              });
            }
            setSavedDocs(grouped);
          }
        }
      } catch {
        setError("Error al cargar los datos. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  /* ---- File handlers with OCR validation ---- */

  /** Appends for multi-file requirements, replaces for single-file ones. */
  function addFile(docTypeId: string, file: File, multiple: boolean) {
    setFiles((prev) => ({
      ...prev,
      [docTypeId]: multiple ? [...(prev[docTypeId] ?? []), file] : [file],
    }));
  }

  async function handleFileChange(docTypeId: string, file: File | null) {
    const docType = documentTypes.find((dt) => dt.id === docTypeId);
    const multiple = !!docType?.allows_multiple;

    if (!file) {
      setFiles((prev) => ({ ...prev, [docTypeId]: [] }));
      setOcrResults((prev) => {
        const next = { ...prev };
        delete next[docTypeId];
        return next;
      });
      return;
    }

    if (!docType) {
      addFile(docTypeId, file, multiple);
      return;
    }

    // Start OCR validation
    setValidatingDocId(docTypeId);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentName", docType.name);

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/v1/ocr/validate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        // If OCR service is unavailable, accept file with warning
        addFile(docTypeId, file, multiple);
        setOcrResults((prev) => ({
          ...prev,
          [docTypeId]: {
            valid: true,
            confidence: "low",
            message: "No se pudo validar automáticamente. Se aceptó para revisión manual.",
            detectedType: "No verificado",
            extractedData: {},
          },
        }));
        return;
      }

      const result = await res.json();

      if (result.valid) {
        addFile(docTypeId, file, multiple);
        setOcrResults((prev) => ({ ...prev, [docTypeId]: result }));
      } else {
        // Document rejected — clear file
        const input = fileInputRefs.current[docTypeId];
        if (input) input.value = "";
        setOcrResults((prev) => ({ ...prev, [docTypeId]: result }));
        // Don't set the file — it's rejected
      }
    } catch {
      // On network error, accept file
      addFile(docTypeId, file, multiple);
      setOcrResults((prev) => ({
        ...prev,
        [docTypeId]: {
          valid: true,
          confidence: "low",
          message: "Validación no disponible. Se aceptó para revisión manual.",
          detectedType: "No verificado",
          extractedData: {},
        },
      }));
    } finally {
      setValidatingDocId(null);
    }
  }

  function removeFile(docTypeId: string, index: number) {
    setFiles((prev) => ({
      ...prev,
      [docTypeId]: (prev[docTypeId] ?? []).filter((_, i) => i !== index),
    }));
    setOcrResults((prev) => {
      const next = { ...prev };
      delete next[docTypeId];
      return next;
    });
    const input = fileInputRefs.current[docTypeId];
    if (input) input.value = "";
  }

  /* ---- Draft persistence ---- */

  /** Creates the draft expediente on first use and returns its id. */
  async function ensureDraft(supabase: ReturnType<typeof createClient>) {
    if (draftId) return draftId;
    if (!property || !user) throw new Error("Faltan datos de la propiedad.");

    const { data, error: expError } = await supabase
      .from("brc_expedientes")
      .insert({
        property_id: property.id,
        requested_by: user.id,
        tariff_id: tariff?.id ?? null,
        notes: notes.trim() || null,
        status: "BORRADOR",
      })
      .select("id")
      .single();

    if (expError || !data) {
      throw new Error(expError?.message ?? "No se pudo crear el borrador.");
    }
    setDraftId(data.id as string);
    return data.id as string;
  }

  /**
   * Uploads every file picked but not yet stored, and persists the notes.
   * Returns the draft id so `handleSubmit` can reuse the same work.
   */
  async function persistProgress(
    supabase: ReturnType<typeof createClient>,
  ): Promise<string> {
    const expedienteId = await ensureDraft(supabase);

    await supabase
      .from("brc_expedientes")
      .update({ notes: notes.trim() || null })
      .eq("id", expedienteId);

    const pending = Object.entries(files).flatMap(([docTypeId, list]) =>
      (list ?? []).map((file) => [docTypeId, file] as const),
    );

    for (const [docTypeId, file] of pending) {
      const docType = documentTypes.find((dt) => dt.id === docTypeId);
      const filePath = `${expedienteId}/${docTypeId}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("brc-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        logError("Upload error:", uploadError);
        throw new Error(`No se pudo subir "${file.name}": ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("brc-documents").getPublicUrl(filePath);

      // Single-file requirements replace what was there; multi-file ones
      // (e.g. one ID per co-owner) accumulate.
      if (!docType?.allows_multiple) {
        for (const previous of savedDocs[docTypeId] ?? []) {
          await supabase.from("brc_documents").delete().eq("id", previous.id);
        }
      }

      const ocr = ocrResults[docTypeId];
      const standaloneChecks =
        Array.isArray(ocr?.standaloneChecks) && ocr.standaloneChecks.length > 0
          ? ocr.standaloneChecks.map((c) => ({
              label: c.label,
              passed: c.status === "pass",
              detail: c.message,
            }))
          : null;

      const { data: inserted, error: docError } = await supabase
        .from("brc_documents")
        .insert({
          expediente_id: expedienteId,
          document_type_id: docTypeId,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: "PENDIENTE",
          uploaded_by: user!.id,
          ocr_detected_type: ocr?.detectedType ?? null,
          ocr_confidence: ocr?.confidence ?? null,
          ocr_valid: ocr?.valid ?? null,
          ocr_extracted_data: ocr?.extractedData ?? null,
          ocr_validated_at: ocr ? new Date().toISOString() : null,
          ocr_standalone_checks: standaloneChecks,
        })
        .select("id, file_name, file_url")
        .single();

      if (docError || !inserted) {
        throw new Error(docError?.message ?? "No se pudo guardar el documento.");
      }

      const savedDoc: SavedDoc = {
        id: inserted.id as string,
        file_name: inserted.file_name as string,
        file_url: inserted.file_url as string,
      };
      setSavedDocs((prev) => ({
        ...prev,
        [docTypeId]: docType?.allows_multiple
          ? [...(prev[docTypeId] ?? []), savedDoc]
          : [savedDoc],
      }));
      // Already persisted — drop it from the pending picks.
      setFiles((prev) => ({ ...prev, [docTypeId]: [] }));
    }

    return expedienteId;
  }

  async function handleSaveDraft() {
    if (!property || !user) return;
    setSavingDraft(true);
    setError(null);
    try {
      await persistProgress(createClient());
      setSavedAt(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el progreso.",
      );
    } finally {
      setSavingDraft(false);
    }
  }

  /* ---- Submit ---- */
  async function handleSubmit() {
    if (!property || !user) return;

    // Validate required documents. Some are only required for certain
    // property types/operations — see lib/brc-documents. A document already
    // saved in the draft counts as provided.
    const missingRequired = documentTypes
      .filter(
        (dt) =>
          isDocumentRequired(dt, property) &&
          (files[dt.id]?.length ?? 0) === 0 &&
          (savedDocs[dt.id]?.length ?? 0) === 0,
      )
      .map((dt) => dt.name);

    if (missingRequired.length > 0) {
      setError(`Faltan documentos obligatorios: ${missingRequired.join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Persist anything still pending, then hand the expediente over for
      // review. Doing it in this order means a failure mid-upload leaves a
      // usable draft instead of a half-submitted request.
      const expedienteId = await persistProgress(supabase);

      const { error: submitError } = await supabase
        .from("brc_expedientes")
        .update({
          status: "EN_REVISION",
          tariff_id: tariff?.id ?? null,
          notes: notes.trim() || null,
        })
        .eq("id", expedienteId);

      if (submitError) {
        throw new Error(submitError.message);
      }

      await supabase
        .from("properties")
        .update({ brc_status: "EN_REVISION" })
        .eq("id", property.id);

      router.push("/dashboard/expedientes");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al procesar la solicitud.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  /* ---- Error / not found ---- */
  if (!property) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium text-gray-700">
          {error ?? "Propiedad no encontrada."}
        </p>
        <Link
          href="/dashboard/propiedades"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          Volver a propiedades
        </Link>
      </div>
    );
  }

  /* ---- Already requested ---- */
  if (property.brc_status !== "NO_SOLICITADO") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldBrc className="h-12 w-12 text-blue-500" />
        <p className="text-lg font-medium text-gray-700">
          Esta propiedad ya tiene una solicitud BRC en estado:{" "}
          <span className="font-bold">{property.brc_status}</span>
        </p>
        <Link
          href="/dashboard/expedientes"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          Ver mis expedientes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* ============================================================ */}
      {/*  Back link                                                    */}
      {/* ============================================================ */}
      <Link
        href="/dashboard/propiedades"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a mis propiedades
      </Link>

      {/* ============================================================ */}
      {/*  Page Title                                                   */}
      {/* ============================================================ */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Solicitar Certificacion BRC
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Completa el formulario para iniciar el proceso de certificacion de tu propiedad.
        </p>
      </div>

      <BrcExclusionNotice />

      {/* ============================================================ */}
      {/*  Property Info Card                                           */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-2xl opacity-80"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        />
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
            }}
          >
            <ShieldBrc className="h-5 w-5" style={{ color: "hsl(221 83% 53%)" }} />
          </div>
          <div className="min-w-0">
            <h3
              className="font-bold text-gray-900 truncate"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              {property.title}
            </h3>
            <p className="text-sm text-gray-500">
              {property.address_line}, {property.city}, {property.state}
            </p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(property.price, property.currency)}
            </p>
            <p className="text-xs text-gray-400">{property.currency}</p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Tariff Card                                                  */}
      {/* ============================================================ */}
      {tariff && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3
            className="text-lg font-bold text-gray-900 mb-4"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Tarifa de Certificacion
          </h3>
          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
            <div>
              <p className="font-semibold text-gray-900">{tariff.name}</p>
              <p className="text-sm text-gray-500">
                Propiedades de {formatCurrency(tariff.price_min, tariff.currency)}
                {tariff.price_max
                  ? ` a ${formatCurrency(tariff.price_max, tariff.currency)}`
                  : " en adelante"}
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-2xl font-bold"
                style={{ color: "hsl(221 83% 53%)" }}
              >
                {formatCurrency(tariff.tariff_amount, tariff.currency)}
              </p>
              <p className="text-xs text-gray-400">+ IVA</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Documents Upload                                             */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3
          className="text-lg font-bold text-gray-900 mb-1"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Documentos
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Sube los documentos necesarios para la certificacion. Los formatos aceptados son PDF, JPG y PNG.
        </p>

        <div className="space-y-4">
          {documentTypes.map((dt) => {
            const picked = files[dt.id] ?? [];
            const saved = savedDocs[dt.id] ?? [];
            const total = picked.length + saved.length;
            const required = property ? isDocumentRequired(dt, property) : dt.is_required;
            const isConditional = !required;
            const isValidating = validatingDocId === dt.id;
            const ocrResult = ocrResults[dt.id];
            const ocrRejected = ocrResult && !ocrResult.valid;

            return (
              <div
                key={dt.id}
                className={`rounded-xl border p-4 transition-all duration-200 ${
                  ocrRejected
                    ? "border-red-200 bg-red-50/30"
                    : ocrResult?.valid && ocrResult.confidence === "high"
                    ? "border-emerald-200 bg-emerald-50/20"
                    : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">
                        {dt.name}
                      </p>
                      {required ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 border border-red-100">
                          Obligatorio
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 border border-amber-100">
                          Opcional
                        </span>
                      )}
                      {saved.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Guardado
                        </span>
                      )}
                    </div>
                    {dt.description && (
                      <p className={`mt-1 text-xs ${isConditional ? "text-amber-500 font-medium" : "text-gray-400"}`}>{dt.description}</p>
                    )}
                  </div>

                  {isValidating ? (
                    <div className="flex items-center gap-2 shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Validando documento...
                    </div>
                  ) : (
                    <label
                      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 hover:shadow-sm`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {total === 0
                        ? "Subir archivo"
                        : dt.allows_multiple
                          ? "Agregar otro"
                          : "Reemplazar"}
                      <input
                        ref={(el) => {
                          fileInputRefs.current[dt.id] = el;
                        }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          handleFileChange(dt.id, e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Files attached to this requirement */}
                {total > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {saved.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{doc.file_name}</span>
                        <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                          Guardado
                        </span>
                      </li>
                    ))}
                    {picked.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate">{f.name}</span>
                        <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Sin guardar
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(dt.id, idx)}
                          aria-label={`Quitar ${f.name}`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* OCR Validation Result */}
                {ocrResult && (
                  <div className={`mt-3 rounded-lg px-3 py-2 text-xs border ${
                    ocrRejected
                      ? "bg-red-50 text-red-700 border-red-200"
                      : ocrResult.confidence === "high"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    <div className="flex items-start gap-2">
                      {ocrRejected ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : ocrResult.confidence === "high" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold">{ocrResult.message}</p>
                        {ocrResult.valid && ocrResult.extractedData && Object.keys(ocrResult.extractedData).length > 1 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] opacity-70 hover:opacity-100">
                              Ver datos extraídos
                            </summary>
                            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                              {Object.entries(ocrResult.extractedData)
                                .filter(([k]) => k !== "tipo_documento" && k !== "raw_text")
                                .map(([key, val]) => (
                                  <div key={key} className="flex gap-1">
                                    <span className="opacity-60">{key.replace(/_/g, " ")}:</span>
                                    <span className="font-medium truncate">{String(val ?? "—")}</span>
                                  </div>
                                ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {documentTypes.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">
                No se encontraron tipos de documentos configurados.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Notes                                                        */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3
          className="text-lg font-bold text-gray-900 mb-1"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Notas Adicionales
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Agrega cualquier comentario o informacion relevante para el proceso de certificacion.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Escribe tus notas aqui..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      {/* ============================================================ */}
      {/*  Privacy Notice                                                */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldBrc className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-800 mb-1">
              Aviso de privacidad
            </p>
            <p className="text-xs leading-relaxed text-blue-700">
              Los documentos proporcionados seran utilizados exclusivamente para la verificacion legal del inmueble y la emision del Certificado BRC. La informacion sera tratada de manera confidencial conforme a la Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares. No se compartiran con terceros no autorizados.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Error message                                                */}
      {/* ============================================================ */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Submit Button                                                */}
      {/* ============================================================ */}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {savedAt && (
          <p className="mr-auto text-xs font-medium text-emerald-600">
            Progreso guardado a las{" "}
            {savedAt.toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Puedes cerrar y continuar después.
          </p>
        )}
        <Link
          href={`/dashboard/propiedades/${id}`}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50"
        >
          Cancelar
        </Link>
        <button
          onClick={handleSaveDraft}
          disabled={savingDraft || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-300 hover:bg-gray-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingDraft ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar progreso
            </>
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || savingDraft}
          className="inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <ShieldBrc className="h-4 w-4" />
              Solicitar Certificacion
            </>
          )}
        </button>
      </div>
    </div>
  );
}
