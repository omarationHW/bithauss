"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/app/dashboard/_context/user-context";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Car,
  Phone,
  Mail,
  Briefcase,
  Plus,
  X,
  Upload,
  Award,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PropertyMedia {
  id: string;
  url: string;
  media_type: string;
  sort_order: number;
}

interface Property {
  id: string;
  title: string;
  description: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_built: number | null;
  parking_spaces: number | null;
  owner_id: string;
  featured_image_url: string | null;
  property_media: PropertyMedia[];
}

interface BrcDocumentTypeNested {
  name: string;
  is_required: boolean;
}

interface BrcDocumentTypeFull {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
}

interface BrcDocument {
  id: string;
  document_type_id: string;
  file_name: string;
  file_url: string | null;
  file_size: number | null;
  status: string;
  rejection_reason: string | null;
  owner_instruction: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  brc_document_types: BrcDocumentTypeNested | null;
  ocr_detected_type: string | null;
  ocr_confidence: string | null;
  ocr_valid: boolean | null;
  ocr_extracted_data: Record<string, unknown> | null;
  ocr_validated_at: string | null;
}

interface ExpedienteLog {
  id: string;
  action: string;
  created_at: string;
  performed_by: string | null;
  metadata: Record<string, unknown> | null;
}

interface OwnerProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role?: string | null;
}

interface Expediente {
  id: string;
  property_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  assigned_notary_id: string | null;
  requested_by: string | null;
  tariff_amount: number | null;
  tariff_currency: string | null;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  EN_REVISION: "En Revision",
  DOCUMENTACION_PENDIENTE: "Documentacion Pendiente",
  VALIDACION_NOTARIAL: "Validacion Notarial",
  CERTIFICADO: "Certificado",
  RECHAZADO: "Rechazado",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  EN_REVISION: "bg-blue-50 text-blue-600 border border-blue-200",
  DOCUMENTACION_PENDIENTE: "bg-amber-50 text-amber-600 border border-amber-200",
  VALIDACION_NOTARIAL: "bg-purple-50 text-purple-600 border border-purple-200",
  CERTIFICADO: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  RECHAZADO: "bg-red-50 text-red-600 border border-red-200",
};

const STATUS_STEPS = [
  { key: "EN_REVISION", label: "En Revision" },
  { key: "DOCUMENTACION_PENDIENTE", label: "Documentacion" },
  { key: "VALIDACION_NOTARIAL", label: "Validacion" },
  { key: "CERTIFICADO", label: "Certificado" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusBadge(status: string) {
  const label = STATUS_LABELS[status] ?? status;
  const style = STATUS_BADGE_STYLES[status] ?? "bg-gray-100 text-gray-600 border border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number, currency: string = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getProgressStep(status: string) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  if (status === "RECHAZADO") return -1;
  return idx >= 0 ? idx : 0;
}

function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 999999) + 1).padStart(6, "0");
  return `BRC-${year}-${seq}`;
}

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? "h-32"}`} />;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExpedienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const expedienteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<BrcDocument[]>([]);
  const [logs, setLogs] = useState<ExpedienteLog[]>([]);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [newNote, setNewNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [allDocumentTypes, setAllDocumentTypes] = useState<BrcDocumentTypeFull[]>([]);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectInstruction, setRejectInstruction] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certNumber] = useState(() => generateCertificateNumber());
  const [certObservations, setCertObservations] = useState("");
  const [certPdfFile, setCertPdfFile] = useState<File | null>(null);
  const [certSubmitting, setCertSubmitting] = useState(false);
  const [rejectExpedienteConfirm, setRejectExpedienteConfirm] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  const isNotario = user?.role === "NOTARIO";
  const supabase = useMemo(() => createClient(), []);

  /* ---------------------------------------------------------------- */
  /*  Fetch all data                                                   */
  /* ---------------------------------------------------------------- */

  const fetchData = useCallback(async () => {
    if (!user || !expedienteId) return;

    // 1. Expediente
    const { data: expData } = await supabase
      .from("brc_expedientes")
      .select("id, property_id, status, notes, created_at, assigned_notary_id, requested_by, tariff_id, brc_tariffs(tariff_amount, currency)")
      .eq("id", expedienteId)
      .maybeSingle();

    if (!expData) {
      setLoading(false);
      return;
    }

    // Map tariff data from join
    const tariffData = (expData as unknown as Record<string, { tariff_amount: number | null; currency: string | null } | null>).brc_tariffs;
    const mappedExp = {
      ...expData,
      tariff_amount: tariffData?.tariff_amount ?? null,
      tariff_currency: tariffData?.currency ?? null,
    };
    setExpediente(mappedExp as Expediente);

    // 2. Property with media
    const { data: propData } = await supabase
      .from("properties")
      .select("id, title, description, address_line, city, state, zip_code, price, currency, bedrooms, bathrooms, area_built, parking_spaces, owner_id, featured_image_url, property_media ( id, url, media_type, sort_order )")
      .eq("id", expData.property_id)
      .maybeSingle();

    if (propData) {
      const p = propData as unknown as Property;
      p.property_media = (p.property_media ?? []).sort((a: { sort_order?: number | null }, b: { sort_order?: number | null }) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setProperty(p);

      // 3. Owner profile
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, role")
        .eq("id", p.owner_id)
        .maybeSingle();

      if (ownerData) setOwner(ownerData as OwnerProfile);
    }

    // 4. Documents
    const { data: docsData } = await supabase
      .from("brc_documents")
      .select("id, document_type_id, file_name, file_url, file_size, status, rejection_reason, owner_instruction, reviewed_at, reviewed_by, created_at, ocr_detected_type, ocr_confidence, ocr_valid, ocr_extracted_data, ocr_validated_at, brc_document_types ( name, is_required )")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: true });

    if (docsData) setDocuments(docsData as unknown as BrcDocument[]);

    // 4b. All document types (for full table)
    const { data: allDocTypes } = await supabase
      .from("brc_document_types")
      .select("id, name, description, is_required, sort_order")
      .order("sort_order", { ascending: true });

    if (allDocTypes) setAllDocumentTypes(allDocTypes as BrcDocumentTypeFull[]);

    // 5. Logs
    const { data: logsData } = await supabase
      .from("brc_expediente_logs")
      .select("id, action, created_at, performed_by, metadata")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false });

    if (logsData) setLogs(logsData as ExpedienteLog[]);

    // 6. Certificate (if status is CERTIFICADO)
    if (expData.status === "CERTIFICADO") {
      const { data: certData } = await supabase
        .from("brc_certificates")
        .select("id")
        .eq("expediente_id", expedienteId)
        .maybeSingle();

      if (certData) setCertificateId(certData.id);
    }

    setLoading(false);
  }, [user, expedienteId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------------------------------------------------------------- */
  /*  Document actions                                                 */
  /* ---------------------------------------------------------------- */

  async function handleApproveDoc(docId: string) {
    setActionLoading(docId);
    const now = new Date().toISOString();
    await supabase
      .from("brc_documents")
      .update({ status: "VALIDADO", reviewed_by: user!.id, reviewed_at: now })
      .eq("id", docId);

    await supabase.from("brc_expediente_logs").insert({
      expediente_id: expedienteId,
      action: "DOCUMENTO_VALIDADO",
      performed_by: user!.id,
      metadata: { doc_id: docId },
    });

    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: "VALIDADO", rejection_reason: null, owner_instruction: null, reviewed_by: user!.id, reviewed_at: now } : d))
    );
    setActionLoading(null);
    // Refresh logs
    const { data: logsData } = await supabase
      .from("brc_expediente_logs")
      .select("id, action, created_at, performed_by, metadata")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false });
    if (logsData) setLogs(logsData as ExpedienteLog[]);
  }

  async function handleRejectDoc(docId: string) {
    if (!rejectReason.trim()) return;
    setActionLoading(docId);
    const now = new Date().toISOString();

    await supabase
      .from("brc_documents")
      .update({
        status: "RECHAZADO",
        rejection_reason: rejectReason.trim(),
        owner_instruction: rejectInstruction.trim() || null,
        reviewed_by: user!.id,
        reviewed_at: now,
      })
      .eq("id", docId);

    await supabase.from("brc_expediente_logs").insert({
      expediente_id: expedienteId,
      action: "DOCUMENTO_RECHAZADO",
      performed_by: user!.id,
      metadata: { doc_id: docId, reason: rejectReason.trim(), instruction: rejectInstruction.trim() || null },
    });

    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, status: "RECHAZADO", rejection_reason: rejectReason.trim(), owner_instruction: rejectInstruction.trim() || null, reviewed_by: user!.id, reviewed_at: now } : d
      )
    );
    setRejectingDocId(null);
    setRejectReason("");
    setRejectInstruction("");
    setActionLoading(null);
    // Refresh logs
    const { data: logsData } = await supabase
      .from("brc_expediente_logs")
      .select("id, action, created_at, performed_by, metadata")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false });
    if (logsData) setLogs(logsData as ExpedienteLog[]);
  }

  /* ---------------------------------------------------------------- */
  /*  Add note                                                         */
  /* ---------------------------------------------------------------- */

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSubmittingNote(true);

    const currentNotes = expediente?.notes ?? "";
    const timestamp = new Date().toLocaleString("es-MX");
    const noteName = user?.fullName ?? "Notario";
    const updated = `${currentNotes}\n\n[${timestamp}] ${noteName}: ${newNote.trim()}`.trim();

    await supabase
      .from("brc_expedientes")
      .update({ notes: updated })
      .eq("id", expedienteId);

    await supabase.from("brc_expediente_logs").insert({
      expediente_id: expedienteId,
      action: "NOTA_AGREGADA",
      performed_by: user!.id,
      metadata: { note: newNote.trim() },
    });

    setExpediente((prev) => (prev ? { ...prev, notes: updated } : prev));
    setNewNote("");
    setSubmittingNote(false);

    const { data: logsData } = await supabase
      .from("brc_expediente_logs")
      .select("id, action, created_at, performed_by, metadata")
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false });
    if (logsData) setLogs(logsData as ExpedienteLog[]);
  }

  /* ---------------------------------------------------------------- */
  /*  Reject expediente                                                */
  /* ---------------------------------------------------------------- */

  async function handleRejectExpediente() {
    setActionLoading("reject-exp");

    await supabase
      .from("brc_expedientes")
      .update({ status: "RECHAZADO" })
      .eq("id", expedienteId);

    await supabase.from("brc_expediente_logs").insert({
      expediente_id: expedienteId,
      action: "EXPEDIENTE_RECHAZADO",
      performed_by: user!.id,
      new_status: "RECHAZADO",
      metadata: { reason: "Expediente rechazado por notario" },
    });

    setActionLoading(null);
    router.push("/dashboard/expedientes");
  }

  /* ---------------------------------------------------------------- */
  /*  Certificate issuance                                             */
  /* ---------------------------------------------------------------- */

  async function handleIssueCertificate() {
    if (!expediente || !property) return;
    setCertSubmitting(true);

    let pdfUrl: string | null = null;

    // Upload PDF if provided
    if (certPdfFile) {
      const fileName = `certificates/${expedienteId}/${certPdfFile.name}`;
      const { data: uploadData } = await supabase.storage
        .from("brc-documents")
        .upload(fileName, certPdfFile, { upsert: true });

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("brc-documents")
          .getPublicUrl(fileName);
        pdfUrl = urlData?.publicUrl ?? null;
      }
    }

    // 1. Insert certificate
    const { data: certData } = await supabase
      .from("brc_certificates")
      .insert({
        certificate_number: certNumber,
        expediente_id: expedienteId,
        property_id: property.id,
        issued_by: user!.id,
        pdf_url: pdfUrl,
        observations: certObservations.trim() || null,
      })
      .select("id")
      .single();

    const certId = certData?.id ?? null;

    // 2. Update expediente status
    await supabase
      .from("brc_expedientes")
      .update({ status: "CERTIFICADO" })
      .eq("id", expedienteId);

    // 3. Update property brc_status
    await supabase
      .from("properties")
      .update({
        brc_status: "CERTIFICADO",
        ...(certId ? { brc_certificate_id: certId } : {}),
      })
      .eq("id", property.id);

    // 4. Insert validation record
    await supabase.from("brc_validations").insert({
      expediente_id: expedienteId,
      property_id: property.id,
      validated_by: user!.id,
      validation_type: "CERTIFICACION",
      result: "APROBADO",
      notes: certObservations.trim() || null,
    });

    // 5. Log
    await supabase.from("brc_expediente_logs").insert({
      expediente_id: expedienteId,
      action: "CERTIFICADO_EMITIDO",
      performed_by: user!.id,
      new_status: "CERTIFICADO",
      metadata: { certificate_number: certNumber },
    });

    setCertSubmitting(false);
    router.push("/dashboard/expedientes");
  }

  /* ---------------------------------------------------------------- */
  /*  Derived state                                                    */
  /* ---------------------------------------------------------------- */

  const allRequiredValidated = useMemo(() => {
    const required = documents.filter((d) => d.brc_document_types?.is_required);
    if (required.length === 0) return false;
    return required.every((d) => d.status === "VALIDADO" || d.status === "APROBADO");
  }, [documents]);

  const tableRows = useMemo(() => {
    return allDocumentTypes.map((dt) => {
      const doc = documents.find((d) => d.document_type_id === dt.id) ?? null;
      return { docType: dt, doc };
    });
  }, [allDocumentTypes, documents]);

  const notaryDisplayName = user?.fullName ?? "Notario";

  const progressStep = expediente ? getProgressStep(expediente.status) : 0;

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10" />
          <SkeletonBlock className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-80" />
          </div>
          <div className="space-y-6">
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!expediente || !property) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <AlertCircle className="h-16 w-16 text-gray-200 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: "Barlow, Inter, sans-serif" }}>
          Expediente no encontrado
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          El expediente solicitado no existe o no tienes acceso.
        </p>
        <Link
          href="/dashboard/expedientes"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Expedientes
        </Link>
      </div>
    );
  }

  const address = [property.address_line, property.city, property.state].filter(Boolean).join(", ");
  const heroImage = property.property_media[0]?.url ?? null;

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/expedientes"
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-all duration-300 hover:bg-gray-50 hover:text-gray-700 hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2
              className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              {property.title}
            </h2>
            {address && (
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                {address}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {getStatusBadge(expediente.status)}
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(property.price, property.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Ver Certificado button */}
        {expediente.status === "CERTIFICADO" && certificateId && (
          <Link
            href={`/certificado/${certificateId}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
          >
            <Award className="h-4 w-4" />
            Ver Certificado
          </Link>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Progress Bar                                                */}
      {/* ============================================================ */}
      {expediente.status !== "RECHAZADO" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = progressStep >= idx;
              const isCurrent = progressStep === idx;
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                        isCompleted
                          ? "text-white shadow-md"
                          : "border-2 border-gray-200 bg-white text-gray-400"
                      }`}
                      style={
                        isCompleted
                          ? { background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }
                          : undefined
                      }
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`mt-2 text-[11px] font-semibold ${
                        isCurrent ? "text-gray-900" : isCompleted ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className="mx-2 h-0.5 flex-1 rounded-full" style={{
                      background: progressStep > idx
                        ? "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))"
                        : "#e5e7eb",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Two-column layout                                           */}
      {/* ============================================================ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* ---- Property Info Card ---- */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            {/* Image gallery */}
            {heroImage && (
              <div className="relative h-64 w-full overflow-hidden bg-gray-100">
                <Image
                  src={heroImage}
                  alt={property.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {property.property_media.length > 1 && (
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    +{property.property_media.length - 1} fotos
                  </div>
                )}
              </div>
            )}

            <div className="p-6">
              <h3
                className="text-lg font-bold text-gray-900 mb-2"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Informacion de la Propiedad
              </h3>
              {property.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {property.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {property.bedrooms != null && (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <BedDouble className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Recamaras</p>
                      <p className="text-sm font-bold text-gray-900">{property.bedrooms}</p>
                    </div>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Bath className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Banos</p>
                      <p className="text-sm font-bold text-gray-900">{property.bathrooms}</p>
                    </div>
                  </div>
                )}
                {property.area_built != null && (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Maximize2 className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Area</p>
                      <p className="text-sm font-bold text-gray-900">{property.area_built} m²</p>
                    </div>
                  </div>
                )}
                {property.parking_spaces != null && (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Car className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Estacionamiento</p>
                      <p className="text-sm font-bold text-gray-900">{property.parking_spaces}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- Broker / Owner Info ---- */}
          {owner && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3
                className="text-lg font-bold text-gray-900 mb-4"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Informacion del Solicitante
              </h3>
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  {owner.first_name[0]}{owner.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">
                    {owner.first_name} {owner.last_name}
                  </p>
                  {owner.role && (
                    <p className="flex items-center gap-1 text-sm text-gray-500">
                      <Briefcase className="h-3.5 w-3.5" />
                      {owner.role}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700 truncate">{owner.email}</span>
                </div>
                {owner.phone && (
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{owner.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="space-y-6">
          {/* ---- Expediente Info ---- */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3
              className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Informacion del Expediente
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Fecha</span>
                <span className="text-sm font-semibold text-gray-900">{formatDate(expediente.created_at)}</span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Estado</span>
                {getStatusBadge(expediente.status)}
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">ID</span>
                <span className="text-xs font-mono text-gray-500">{expediente.id.slice(0, 8)}...</span>
              </div>
              {expediente.tariff_amount != null && (
                <>
                  <div className="h-px bg-gray-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Tarifa</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(expediente.tariff_amount, expediente.tariff_currency ?? "MXN")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ---- Timeline ---- */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3
              className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Historial de Actividad
            </h3>

            {logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin actividad registrada.</p>
            ) : (
              <div className="space-y-0">
                {logs.slice(0, 10).map((log, idx) => (
                  <div key={log.id} className="relative flex gap-3 pb-4">
                    {/* Vertical line */}
                    {idx < Math.min(logs.length, 10) - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-100" />
                    )}
                    <div
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background:
                          log.action.includes("CERTIFICADO") || log.action.includes("VALIDADO")
                            ? "hsl(160 84% 39% / 0.15)"
                            : log.action.includes("RECHAZADO")
                            ? "hsl(0 72% 51% / 0.15)"
                            : "hsl(221 83% 53% / 0.15)",
                      }}
                    >
                      {log.action.includes("CERTIFICADO") || log.action.includes("VALIDADO") ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : log.action.includes("RECHAZADO") ? (
                        <XCircle className="h-3 w-3 text-red-500" />
                      ) : (
                        <Clock className="h-3 w-3" style={{ color: "hsl(221 83% 53%)" }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-700">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      {log.metadata && (
                        <p className="mt-0.5 text-xs text-gray-500 truncate">{JSON.stringify(log.metadata)}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-gray-400">{formatDateTime(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- Notes ---- */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3
              className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Notas
            </h3>

            {expediente.notes ? (
              <div className="mb-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {expediente.notes}
              </div>
            ) : (
              <p className="mb-4 text-sm text-gray-400">Sin notas.</p>
            )}

            {isNotario && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Agregar una nota..."
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || submittingNote}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  {submittingNote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ---- Final Decision (Notary only) ---- */}
          {isNotario && expediente.status !== "CERTIFICADO" && expediente.status !== "RECHAZADO" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3
                className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Decision Final
              </h3>

              <div className="space-y-3">
                <button
                  onClick={() => setShowCertModal(true)}
                  disabled={!allRequiredValidated}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Award className="h-4 w-4" />
                    Aprobar y Certificar
                  </div>
                </button>
                {!allRequiredValidated && (
                  <p className="text-center text-[11px] text-gray-400">
                    Todos los documentos requeridos deben estar validados para emitir el certificado.
                  </p>
                )}

                {!rejectExpedienteConfirm ? (
                  <button
                    onClick={() => setRejectExpedienteConfirm(true)}
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition-all duration-300 hover:bg-red-100"
                  >
                    Rechazar Expediente
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600 font-semibold text-center">
                      Estas seguro de rechazar este expediente?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRejectExpedienteConfirm(false)}
                        className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-600 transition-all hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleRejectExpediente}
                        disabled={actionLoading === "reject-exp"}
                        className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50"
                      >
                        {actionLoading === "reject-exp" ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          "Si, Rechazar"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Documents Table (full width - Módulo Notarial)              */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="p-6 pb-0">
          <h3
            className="text-lg font-bold text-gray-900 mb-1"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Documentos del Expediente
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Revisión y dictamen jurídico de documentos
          </p>
        </div>

        {tableRows.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-8 text-center mx-6 mb-6">
            <FileText className="mx-auto h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No se encontraron tipos de documentos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-left">
              <thead>
                <tr
                  className="text-[11px] font-bold text-white uppercase tracking-wider"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(210 80% 45%))" }}
                >
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-3 py-3">Fecha Revisión</th>
                  <th className="px-3 py-3">Validación de Documentos</th>
                  <th className="px-3 py-3">Certificado Recibido</th>
                  <th className="px-3 py-3">Resultado del Dictamen</th>
                  <th className="px-3 py-3">Dictaminador Jurídico de Notaría</th>
                  <th className="px-3 py-3">Inconsistencia Detectada</th>
                  <th className="px-3 py-3">Instrucción al Propietario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tableRows.map(({ docType, doc }) => {
                  const hasFile = !!doc;
                  const isReviewed = doc?.reviewed_at != null;
                  const isApproved = doc?.status === "VALIDADO" || doc?.status === "APROBADO";
                  const isRejected = doc?.status === "RECHAZADO";
                  const isRejecting = doc && rejectingDocId === doc.id;

                  const isConditional = !docType.is_required;

                  return (
                    <tr
                      key={docType.id}
                      className={`text-xs transition-colors ${
                        isRejected ? "bg-red-50/40" : isApproved ? "bg-emerald-50/30" : "bg-white hover:bg-gray-50/50"
                      }`}
                    >
                      {/* DOCUMENTO */}
                      <td className="px-4 py-3 align-top">
                        <div>
                          <p className="font-bold text-gray-900 text-[12px] leading-tight">
                            {docType.name}
                          </p>
                          {isConditional && docType.description && (
                            <span className="text-[10px] text-amber-600 leading-tight block">{docType.description}</span>
                          )}
                          {hasFile && doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 hover:underline"
                            >
                              <Download className="h-3 w-3" />
                              {doc.file_name}
                            </a>
                          )}
                          {hasFile && doc.ocr_confidence && (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                doc.ocr_confidence === "high"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : doc.ocr_confidence === "medium"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              OCR {doc.ocr_confidence === "high" ? "Alta" : doc.ocr_confidence === "medium" ? "Media" : "Baja"}
                            </span>
                          )}
                          {hasFile && doc.ocr_extracted_data && Object.keys(doc.ocr_extracted_data).length > 0 && (
                            <details className="mt-1 group">
                              <summary className="cursor-pointer text-[10px] font-semibold text-gray-500 hover:text-gray-700">
                                Ver datos extraídos
                              </summary>
                              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-md bg-gray-50 p-2">
                                {Object.entries(doc.ocr_extracted_data)
                                  .filter(([k]) => k !== "textoExtraido")
                                  .map(([k, v]) => (
                                    <div key={k} className="min-w-0">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                        {k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()).trim()}
                                      </p>
                                      <p className="text-[10px] font-medium text-gray-900 break-words">
                                        {v == null || v === ""
                                          ? "—"
                                          : Array.isArray(v)
                                          ? v.map((x) => (typeof x === "object" && x !== null ? Object.values(x as Record<string, unknown>).join(" — ") : String(x))).join(", ")
                                          : typeof v === "object"
                                          ? Object.values(v as Record<string, unknown>).filter(Boolean).join(" ")
                                          : String(v)}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </td>

                      {/* FECHA REVISIÓN */}
                      <td className="px-3 py-3 align-top text-gray-600">
                        {doc?.reviewed_at ? formatDate(doc.reviewed_at) : doc?.created_at ? formatDate(doc.created_at) : "—"}
                      </td>

                      {/* VALIDACIÓN DE DOCUMENTOS */}
                      <td className="px-3 py-3 align-top">
                        {isReviewed ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            REALIZADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-200">
                            PENDIENTE
                          </span>
                        )}
                      </td>

                      {/* CERTIFICADO RECIBIDO */}
                      <td className="px-3 py-3 align-top">
                        {hasFile ? (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                            RECIBIDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-400 border border-gray-200">
                            —
                          </span>
                        )}
                      </td>

                      {/* RESULTADO DEL DICTAMEN */}
                      <td className="px-3 py-3 align-top">
                        {isApproved ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            APROBADO
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-200">
                            RECHAZADO
                          </span>
                        ) : hasFile && isNotario && doc.status !== "VALIDADO" ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleApproveDoc(doc.id)}
                              disabled={actionLoading === doc.id}
                              className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-200 transition-all hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {actionLoading === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Aprobar
                            </button>
                            <button
                              onClick={() => {
                                setRejectingDocId(doc.id);
                                setRejectReason(doc.rejection_reason ?? "");
                                setRejectInstruction(doc.owner_instruction ?? "");
                              }}
                              disabled={actionLoading === doc.id}
                              className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 border border-red-200 transition-all hover:bg-red-100 disabled:opacity-50"
                            >
                              <XCircle className="h-3 w-3" />
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>

                      {/* DICTAMINADOR JURÍDICO */}
                      <td className="px-3 py-3 align-top text-gray-700">
                        {(isApproved || isRejected) && doc?.reviewed_by
                          ? notaryDisplayName
                          : ""}
                      </td>

                      {/* INCONSISTENCIA DETECTADA */}
                      <td className="px-3 py-3 align-top">
                        {isRejecting ? (
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Describir la inconsistencia..."
                            rows={2}
                            className="w-full rounded-md border border-red-200 px-2 py-1.5 text-[11px] text-gray-800 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 resize-none"
                            autoFocus
                          />
                        ) : isRejected && doc?.rejection_reason ? (
                          <p className="text-[11px] text-red-700 leading-relaxed">{doc.rejection_reason}</p>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>

                      {/* INSTRUCCIÓN AL PROPIETARIO */}
                      <td className="px-3 py-3 align-top">
                        {isRejecting ? (
                          <div className="space-y-1.5">
                            <textarea
                              value={rejectInstruction}
                              onChange={(e) => setRejectInstruction(e.target.value)}
                              placeholder="Instrucción para el propietario..."
                              rows={2}
                              className="w-full rounded-md border border-red-200 px-2 py-1.5 text-[11px] text-gray-800 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 resize-none"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => doc && handleRejectDoc(doc.id)}
                                disabled={!rejectReason.trim() || actionLoading === doc?.id}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingDocId(null);
                                  setRejectReason("");
                                  setRejectInstruction("");
                                }}
                                className="rounded-md border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition-all hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : isRejected && doc?.owner_instruction ? (
                          <p className="text-[11px] text-red-700 leading-relaxed">{doc.owner_instruction}</p>
                        ) : (
                          <span className="text-[10px] text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Certificate Issuance Modal                                  */}
      {/* ============================================================ */}
      {showCertModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !certSubmitting && setShowCertModal(false)}
        >
          <div
            className="w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-6 text-white"
              style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold"
                      style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                    >
                      Emitir Certificado BRC
                    </h3>
                    <p className="text-sm text-white/70">
                      {property.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !certSubmitting && setShowCertModal(false)}
                  className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Certificate number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Numero de Certificado
                </label>
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                  <ShieldCheck className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-mono font-bold text-gray-900">{certNumber}</span>
                  <span className="ml-auto text-[10px] text-gray-400">Auto-generado</span>
                </div>
              </div>

              {/* Observations */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Observaciones
                </label>
                <textarea
                  value={certObservations}
                  onChange={(e) => setCertObservations(e.target.value)}
                  placeholder="Observaciones adicionales del certificado..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none transition-all focus:border-blue-300 focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Certificado Firmado (PDF)
                </label>
                {certPdfFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800 truncate flex-1">
                      {certPdfFile.name}
                    </span>
                    <button
                      onClick={() => setCertPdfFile(null)}
                      className="text-emerald-600 hover:text-emerald-800 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-6 transition-all hover:border-gray-300 hover:bg-gray-50">
                    <Upload className="h-6 w-6 text-gray-300" />
                    <span className="text-sm text-gray-500">
                      Click para subir PDF firmado
                    </span>
                    <span className="text-xs text-gray-400">Opcional</span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCertPdfFile(file);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCertModal(false)}
                  disabled={certSubmitting}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleIssueCertificate}
                  disabled={certSubmitting}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  {certSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Award className="h-4 w-4" />
                      Emitir Certificado
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
