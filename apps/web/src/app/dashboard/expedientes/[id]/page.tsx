"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getSignedDocumentUrl } from "@/lib/private-storage";
import { runOcrValidation, ocrColumns } from "@/lib/ocr-validate";
import { useUser } from "@/app/dashboard/_context/user-context";
import { ShieldBrc } from '@/components/ui/shield-brc'
import { type OcrStandaloneCheck } from '@/components/brc/ocr-document-review'
import {
  ExpedienteDocumentsTable,
  type CertTrackingPatch,
  type ExpedienteTableRow,
} from "@/components/brc/expediente-documents-table";
import {
  BRC_STATUS,
  BRC_STATUS_BADGE_STYLES,
  BRC_STATUS_LABELS,
  BRC_STATUS_STEPS,
  areRequiredDocumentsValidated,
  getBrcProgressStep,
  missingRequiredDocuments,
} from "@/lib/brc-notarial";
import {
  ArrowLeft,
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
  Stamp,
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
  type: string | null;
  operation: string | null;
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
  /** Persisted at review time — never the name of whoever is looking now. */
  reviewer_name: string | null;
  created_at: string;
  /* Certificates the notary collects from RPP / Predial / Agua / otros. */
  cert_requested_at: string | null;
  cert_received_at: string | null;
  cert_result: string | null;
  cert_requirement: string | null;
  notary_legal_opinion: string | null;
  brc_document_types: BrcDocumentTypeNested | null;
  ocr_detected_type: string | null;
  ocr_confidence: string | null;
  ocr_valid: boolean | null;
  ocr_extracted_data: Record<string, unknown> | null;
  ocr_corrected_data: Record<string, unknown> | null;
  ocr_standalone_checks: OcrStandaloneCheck[] | null;
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

/**
 * The Certificado Notarial: the notary's statement that the file is sound.
 * BitHauss issues the BRC from it — this is not the BRC.
 */
interface NotarialCertificate {
  id: string;
  file_url: string;
  file_name: string;
  observations: string | null;
  issued_at: string;
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

/* Labels, badge styles and the stepper now live in @/lib/brc-notarial so the
   list, the detail screen and the admin console cannot disagree about what
   PENDIENTE_EMISION_BRC means. */
const STATUS_LABELS = BRC_STATUS_LABELS;
const STATUS_BADGE_STYLES = BRC_STATUS_BADGE_STYLES;
const STATUS_STEPS = BRC_STATUS_STEPS;

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

const getProgressStep = getBrcProgressStep;

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [certObservations, setCertObservations] = useState("");
  const [certPdfFile, setCertPdfFile] = useState<File | null>(null);
  const [certSubmitting, setCertSubmitting] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  /** The Certificado Notarial in force, when the notary already issued it. */
  const [notarialCert, setNotarialCert] = useState<NotarialCertificate | null>(null);
  /** Document whose "certificados recabados" block is being saved. */
  const [savingTrackingDocId, setSavingTrackingDocId] = useState<string | null>(null);
  /** Document whose signed URL is being minted. */
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  /** Document type whose corrected file is being uploaded. */
  const [reuploadingTypeId, setReuploadingTypeId] = useState<string | null>(null);
  const [rejectExpedienteConfirm, setRejectExpedienteConfirm] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  const isNotario = user?.role === "NOTARIO";
  /** The owner who filed the request: the only one who can fix documents. */
  const isRequester = !!user && expediente?.requested_by === user.id;
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
      .select("id, title, description, address_line, city, state, zip_code, price, currency, type, operation, bedrooms, bathrooms, area_built, parking_spaces, owner_id, featured_image_url, property_media ( id, url, media_type, sort_order )")
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
      .select("id, document_type_id, file_name, file_url, file_size, status, rejection_reason, owner_instruction, reviewed_at, reviewed_by, reviewer_name, created_at, cert_requested_at, cert_received_at, cert_result, cert_requirement, notary_legal_opinion, ocr_detected_type, ocr_confidence, ocr_valid, ocr_extracted_data, ocr_corrected_data, ocr_standalone_checks, ocr_validated_at, brc_document_types ( name, is_required )")
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

    // 6. Certificado Notarial in force (basis for the BRC). Fetched for every
    //    status: once issued it stays part of the record.
    const { data: notarialData } = await supabase
      .from("brc_notarial_certificates")
      .select("id, file_url, file_name, observations, issued_at")
      .eq("expediente_id", expedienteId)
      .is("superseded_at", null)
      .maybeSingle();

    setNotarialCert((notarialData as NotarialCertificate | null) ?? null);

    // 7. BRC certificate (only BitHauss can have issued it)
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
    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/brc/documents/${docId}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    });

    if (res.ok) {
      // The API decides (and persists) the reviewer name; echo it back rather
      // than rendering whoever happens to be logged in.
      const payload = (await res.json().catch(() => null)) as
        | { reviewed_at?: string; reviewer_name?: string | null }
        | null;
      const now = payload?.reviewed_at ?? new Date().toISOString();
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: "VALIDADO",
                rejection_reason: null,
                owner_instruction: null,
                reviewed_by: user!.id,
                reviewer_name: payload?.reviewer_name ?? user?.fullName ?? null,
                reviewed_at: now,
              }
            : d,
        ),
      );
      const { data: logsData } = await supabase
        .from("brc_expediente_logs")
        .select("id, action, created_at, performed_by, metadata")
        .eq("expediente_id", expedienteId)
        .order("created_at", { ascending: false });
      if (logsData) setLogs(logsData as ExpedienteLog[]);
    }
    setActionLoading(null);
  }

  async function handleRejectDoc(
    docId: string,
    payload: { reason: string; owner_instruction?: string },
  ) {
    if (!payload.reason.trim()) return;
    setActionLoading(docId);
    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/brc/documents/${docId}/reject`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        reason: payload.reason.trim(),
        owner_instruction: payload.owner_instruction?.trim() || undefined,
      }),
    });

    if (res.ok) {
      const result = (await res.json().catch(() => null)) as
        | { reviewed_at?: string; reviewer_name?: string | null }
        | null;
      const now = result?.reviewed_at ?? new Date().toISOString();
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: "RECHAZADO",
                rejection_reason: payload.reason.trim(),
                owner_instruction: payload.owner_instruction?.trim() || null,
                reviewed_by: user!.id,
                reviewer_name: result?.reviewer_name ?? user?.fullName ?? null,
                reviewed_at: now,
              }
            : d
        )
      );
      const { data: logsData } = await supabase
        .from("brc_expediente_logs")
        .select("id, action, created_at, performed_by, metadata")
        .eq("expediente_id", expedienteId)
        .order("created_at", { ascending: false });
      if (logsData) setLogs(logsData as ExpedienteLog[]);
    }

    setActionLoading(null);
  }

  /** Saves the "certificados recabados por notaría" block of one requirement. */
  async function handleSaveCertTracking(docId: string, patch: CertTrackingPatch) {
    setSavingTrackingDocId(docId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(
        `${apiBase}/api/v1/brc/documents/${docId}/certificate-tracking`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify(patch),
        },
      );

      if (!res.ok) {
        window.alert("No se pudieron guardar los certificados recabados.");
        return;
      }

      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
      );
    } finally {
      setSavingTrackingDocId(null);
    }
  }

  /** Apply an OCR correction to local state after a successful PATCH. */
  function handleDocCorrected(docId: string, correctedData: Record<string, unknown>) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, ocr_corrected_data: correctedData } : d))
    );
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
    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/brc/expedientes/${expedienteId}/reject`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ reason: "Expediente rechazado por notario" }),
    });

    setActionLoading(null);
    if (res.ok) router.push("/dashboard/expedientes");
  }

  /* ---------------------------------------------------------------- */
  /*  Certificate issuance                                             */
  /* ---------------------------------------------------------------- */

  /** Documents can only be fixed while the expediente is still open. */
  const canFixDocuments =
    !!expediente &&
    expediente.status !== "CERTIFICADO" &&
    expediente.status !== "RECHAZADO";

  /**
   * Uploads a corrected file for a rejected requirement. A NEW row is created
   * so the rejection and its reason stay in the record; the table shows the
   * latest version.
   */
  async function handleReupload(documentTypeId: string, file: File) {
    if (!expediente || !user) return;
    setReuploadingTypeId(documentTypeId);
    try {
      // Same OCR pass the original upload gets, so the notary reviews the
      // corrected file with its analysis instead of a bare PDF.
      const docTypeName =
        allDocumentTypes.find((dt) => dt.id === documentTypeId)?.name ?? "";
      const ocr = await runOcrValidation(file, docTypeName);

      const path = `${expediente.id}/${documentTypeId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("brc-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("brc-documents").getPublicUrl(path);

      const { error: insertError } = await supabase.from("brc_documents").insert({
        expediente_id: expediente.id,
        document_type_id: documentTypeId,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        status: "PENDIENTE",
        uploaded_by: user.id,
        ...ocrColumns(ocr),
      });
      if (insertError) throw new Error(insertError.message);

      // Back to the reviewers' court.
      if (expediente.status === "DOCUMENTACION_PENDIENTE") {
        await supabase
          .from("brc_expedientes")
          .update({ status: "EN_REVISION" })
          .eq("id", expediente.id);
      }

      await fetchData();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? `No se pudo subir el documento: ${err.message}`
          : "No se pudo subir el documento.",
      );
    } finally {
      setReuploadingTypeId(null);
    }
  }

  /**
   * `brc-documents` is a private bucket, so the stored `file_url` (built with
   * getPublicUrl) cannot be opened directly. Mint a short-lived signed URL on
   * click instead — storage RLS still decides who gets one.
   */
  async function openDocument(docId: string, fileUrl: string) {
    setOpeningDocId(docId);
    try {
      const signed = await getSignedDocumentUrl(supabase, fileUrl);
      if (!signed) {
        window.alert(
          "No se pudo abrir el documento. Puede que el archivo ya no exista o que no tengas acceso.",
        );
        return;
      }
      window.open(signed, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningDocId(null);
    }
  }

  /**
   * Step A: the notary uploads the CERTIFICADO NOTARIAL. This does not issue
   * the BRC — BitHauss does that from this document — so the expediente lands
   * on PENDIENTE_EMISION_BRC and the seal stays off until then.
   */
  async function handleIssueNotarialCertificate() {
    if (!expediente || !property) return;
    if (!certPdfFile) {
      setCertError("Adjunta el Certificado Notarial en PDF para continuar.");
      return;
    }

    setCertSubmitting(true);
    setCertError(null);

    try {
      // Storage write stays client-side; storage RLS (migración 021/024) is
      // what decides whether this notary may write into the folder.
      const fileName = `certificates/${expedienteId}/notarial-${Date.now()}-${certPdfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("brc-documents")
        .upload(fileName, certPdfFile, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("brc-documents")
        .getPublicUrl(fileName);
      const fileUrl = urlData?.publicUrl;
      if (!fileUrl) throw new Error("No se pudo resolver la ruta del archivo.");

      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(
        `${apiBase}/api/v1/brc/expedientes/${expedienteId}/notarial-certificate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            file_url: fileUrl,
            file_name: certPdfFile.name,
            file_size: certPdfFile.size,
            mime_type: certPdfFile.type || "application/pdf",
            observations: certObservations.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(
          body?.message ?? "No se pudo emitir el Certificado Notarial.",
        );
      }

      setShowCertModal(false);
      setCertPdfFile(null);
      setCertObservations("");
      await fetchData();
    } catch (err) {
      setCertError(
        err instanceof Error ? err.message : "No se pudo emitir el Certificado Notarial.",
      );
    } finally {
      setCertSubmitting(false);
    }
  }

  /** Opens the Certificado Notarial through a short-lived signed URL. */
  async function openNotarialCertificate() {
    if (!notarialCert) return;
    const signed = await getSignedDocumentUrl(supabase, notarialCert.file_url);
    if (!signed) {
      window.alert("No se pudo abrir el Certificado Notarial.");
      return;
    }
    window.open(signed, "_blank", "noopener,noreferrer");
  }

  /* ---------------------------------------------------------------- */
  /*  Derived state                                                    */
  /* ---------------------------------------------------------------- */

  const tableRows = useMemo<ExpedienteTableRow[]>(() => {
    return allDocumentTypes.map((dt) => {
      // A correction adds a new row instead of overwriting, so the rejected
      // version stays in the record — show the most recent one.
      const matches = documents
        .filter((d) => d.document_type_id === dt.id)
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      return { docType: dt, doc: matches[0] ?? null };
    });
  }, [allDocumentTypes, documents]);

  /**
   * Certification is gated on the REQUIRED document types, judged by the most
   * recent version of each.
   *
   * The old check looked at uploaded rows instead of types, which broke twice:
   * a rejected document that was later corrected kept its old RECHAZADO row in
   * the list and blocked certification forever, and a required type that was
   * never uploaded at all did not block anything because it had no row to
   * inspect. Optional documents are ignored — that is what optional means.
   */
  const requirementRows = useMemo(
    () =>
      tableRows.map(({ docType, doc }) => ({
        name: docType.name,
        is_required: !!docType.is_required,
        status: doc?.status ?? null,
      })),
    [tableRows],
  );

  const propertyForBrc = useMemo(
    () => ({
      type: property?.type ?? null,
      operation: property?.operation ?? null,
    }),
    [property],
  );

  const allRequiredValidated = useMemo(
    () => areRequiredDocumentsValidated(requirementRows, propertyForBrc),
    [requirementRows, propertyForBrc],
  );

  /** Names of the required documents still standing between here and the
   *  certificate — so the notary is told what is missing, not just that
   *  something is. */
  const pendingRequiredNames = useMemo(
    () => missingRequiredDocuments(requirementRows, propertyForBrc),
    [requirementRows, propertyForBrc],
  );

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
  // `property_media` holds photos AND videos since migración 030, so the hero
  // and the "+N fotos" counter have to be taken from the photos alone: an
  // unsplit `[0]` puts an .mp4 (or a YouTube watch URL) inside <Image>.
  const propertyPhotos = property.property_media.filter(
    (m) => (m.media_type ?? "IMAGE") === "IMAGE",
  );
  const heroImage = propertyPhotos[0]?.url ?? null;

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
                {propertyPhotos.length > 1 && (
                  <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    +{propertyPhotos.length - 1} fotos
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

          {/* ---- Certificado Notarial (basis for the BRC) ---- */}
          {notarialCert && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm">
              <h3
                className="mb-2 text-sm font-bold uppercase tracking-wider text-indigo-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Certificado Notarial
              </h3>
              <p className="text-xs leading-relaxed text-indigo-900/80">
                {expediente.status === BRC_STATUS.CERTIFICADO
                  ? "Sustento legal del certificado BRC emitido por BitHauss."
                  : "La notaría hizo constar que el expediente está en regla. BitHauss emitirá el certificado BRC a partir de este documento."}
              </p>
              <p className="mt-2 text-[11px] text-indigo-900/60">
                Emitido el {formatDate(notarialCert.issued_at)}
              </p>
              {notarialCert.observations && (
                <p className="mt-2 rounded-lg bg-white/70 p-3 text-[11px] leading-relaxed text-indigo-900/80">
                  {notarialCert.observations}
                </p>
              )}
              <button
                type="button"
                onClick={openNotarialCertificate}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 transition-all hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Download className="h-3.5 w-3.5" />
                Ver Certificado Notarial
              </button>
            </div>
          )}

          {/* ---- Notarial ruling (Notary only) ---- */}
          {isNotario && expediente.status !== "CERTIFICADO" && expediente.status !== "RECHAZADO" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3
                className="text-sm font-bold text-gray-900 mb-1 uppercase tracking-wider"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Dictamen Notarial
              </h3>
              <p className="mb-4 text-[11px] leading-relaxed text-gray-500">
                Emites el Certificado Notarial. BitHauss emite el BRC a partir
                de él y coloca el sello en la publicación.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setShowCertModal(true)}
                  disabled={!allRequiredValidated}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Stamp className="h-4 w-4" />
                    {notarialCert
                      ? "Re-emitir Certificado Notarial"
                      : "Emitir Certificado Notarial"}
                  </div>
                </button>
                {!allRequiredValidated && (
                  <div className="text-center text-[11px] text-gray-400">
                    <p>
                      Faltan documentos obligatorios por validar
                      {pendingRequiredNames.length > 0 ? ":" : "."}
                    </p>
                    {pendingRequiredNames.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-left">
                        {pendingRequiredNames.map((name) => (
                          <li key={name} className="text-amber-600">
                            · {name}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1">
                      Los documentos opcionales no bloquean la emisión del
                      Certificado Notarial.
                    </p>
                  </div>
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

        <ExpedienteDocumentsTable
          rows={tableRows}
          isNotario={isNotario}
          isRequester={isRequester}
          canFixDocuments={canFixDocuments}
          notarialCertificate={notarialCert}
          actionLoadingId={actionLoading}
          openingDocId={openingDocId}
          reuploadingTypeId={reuploadingTypeId}
          savingTrackingDocId={savingTrackingDocId}
          onOpenDocument={openDocument}
          onApproveDocument={handleApproveDoc}
          onRejectDocument={handleRejectDoc}
          onReuploadDocument={handleReupload}
          onDocumentCorrected={handleDocCorrected}
          onSaveCertTracking={isNotario ? handleSaveCertTracking : undefined}
          onOpenNotarialCertificate={
            notarialCert ? openNotarialCertificate : undefined
          }
        />
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
                      Emitir Certificado Notarial
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
              {/* What this document is — and what it is not. */}
              <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <ShieldBrc className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="space-y-1 text-xs leading-relaxed text-blue-900">
                  <p className="font-bold">
                    Estás subiendo el Certificado Notarial, no el BRC.
                  </p>
                  <p>
                    Con este documento haces constar que el expediente de la
                    propiedad está en regla. Es el sustento legal del
                    certificado BRC: <strong>BitHauss</strong> lo emitirá a
                    partir de él, lo tokenizará y colocará el sello en la
                    publicación del inmueble.
                  </p>
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
                  Certificado Notarial firmado (PDF)
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
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
                      Haz clic para subir el PDF firmado
                    </span>
                    <span className="text-xs text-gray-400">Obligatorio</span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      aria-label="Certificado Notarial firmado en PDF"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCertPdfFile(file);
                          setCertError(null);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {certError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
                >
                  {certError}
                </p>
              )}

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
                  onClick={handleIssueNotarialCertificate}
                  disabled={certSubmitting || !certPdfFile}
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
                      <Stamp className="h-4 w-4" />
                      Emitir Certificado Notarial
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
