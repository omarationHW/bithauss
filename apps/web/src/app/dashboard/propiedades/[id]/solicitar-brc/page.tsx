"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Upload,
  FileText,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/app/dashboard/_context/user-context";

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
}

interface BrcTariff {
  id: string;
  name: string;
  price_min: number;
  price_max: number | null;
  tariff_amount: number;
  currency: string;
}

interface BrcDocumentType {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
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
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* ---- Fetch property, tariff and document types ---- */
  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        // Fetch property
        const { data: prop, error: propError } = await supabase
          .from("properties")
          .select("id, title, address_line, city, state, price, currency, brc_status")
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
      } catch {
        setError("Error al cargar los datos. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  /* ---- File handlers ---- */
  function handleFileChange(docTypeId: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [docTypeId]: file }));
  }

  function removeFile(docTypeId: string) {
    setFiles((prev) => ({ ...prev, [docTypeId]: null }));
    const input = fileInputRefs.current[docTypeId];
    if (input) input.value = "";
  }

  /* ---- Submit ---- */
  async function handleSubmit() {
    if (!property || !user) return;

    // Validate required documents
    const missingRequired = documentTypes
      .filter((dt) => dt.is_required && !files[dt.id])
      .map((dt) => dt.name);

    if (missingRequired.length > 0) {
      setError(`Faltan documentos requeridos: ${missingRequired.join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Create expediente
      const { data: expediente, error: expError } = await supabase
        .from("brc_expedientes")
        .insert({
          property_id: property.id,
          requested_by: user.id,
          tariff_id: tariff?.id ?? null,
          notes: notes.trim() || null,
          status: "EN_REVISION",
        })
        .select("id")
        .single();

      if (expError || !expediente) {
        throw new Error(expError?.message ?? "Error al crear el expediente.");
      }

      // 2. Update property brc_status
      await supabase
        .from("properties")
        .update({ brc_status: "EN_REVISION" })
        .eq("id", property.id);

      // 3. Upload documents and create records
      const fileEntries = Object.entries(files).filter(
        (entry): entry is [string, File] => entry[1] !== null
      );

      for (const [docTypeId, file] of fileEntries) {
        const filePath = `${expediente.id}/${docTypeId}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("brc-documents")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("brc-documents").getPublicUrl(filePath);

        await supabase.from("brc_documents").insert({
          expediente_id: expediente.id,
          document_type_id: docTypeId,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: "PENDIENTE",
          uploaded_by: user.id,
        });
      }

      // 4. Redirect to expedientes
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
        <ShieldCheck className="h-12 w-12 text-blue-500" />
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
        href={`/dashboard/propiedades/${id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la propiedad
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
            <ShieldCheck className="h-5 w-5" style={{ color: "hsl(221 83% 53%)" }} />
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
          Documentos Requeridos
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Sube los documentos necesarios para la certificacion. Los formatos aceptados son PDF, JPG y PNG.
        </p>

        <div className="space-y-4">
          {documentTypes.map((dt) => {
            const file = files[dt.id];
            return (
              <div
                key={dt.id}
                className="rounded-xl border border-gray-100 p-4 transition-all duration-200 hover:border-gray-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">
                        {dt.name}
                      </p>
                      {dt.is_required ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 border border-red-100">
                          Requerido
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 border border-gray-100">
                          (Opcional)
                        </span>
                      )}
                    </div>
                    {dt.description && (
                      <p className="mt-1 text-xs text-gray-400">{dt.description}</p>
                    )}
                  </div>

                  {file ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="max-w-[140px] truncate">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(dt.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 hover:shadow-sm">
                      <Upload className="h-3.5 w-3.5" />
                      Subir archivo
                      <input
                        ref={(el) => {
                          fileInputRefs.current[dt.id] = el;
                        }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileChange(dt.id, e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  )}
                </div>
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
      <div className="flex justify-end gap-3">
        <Link
          href={`/dashboard/propiedades/${id}`}
          className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50"
        >
          Cancelar
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
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
              <ShieldCheck className="h-4 w-4" />
              Solicitar Certificacion
            </>
          )}
        </button>
      </div>
    </div>
  );
}
