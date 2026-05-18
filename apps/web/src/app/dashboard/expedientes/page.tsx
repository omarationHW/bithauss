"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Plus,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Inbox,
  X,
  MapPin,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/app/dashboard/_context/user-context";
import { ShieldBrc } from '@/components/ui/shield-brc'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EligibleProperty {
  id: string;
  title: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  price: number;
  currency: string;
}

interface BrcDocument {
  id: string;
  document_type_id: string;
  file_name: string;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  ocr_valid: boolean | null;
  ocr_confidence: string | null;
  brc_document_types: {
    name: string;
  } | null;
}

interface Expediente {
  id: string;
  property_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  assigned_notary_id: string | null;
  requested_by: string | null;
  properties: {
    title: string;
  } | null;
  notary_profile: {
    first_name: string;
    last_name: string;
  } | null;
  requester_profile: {
    first_name: string;
    last_name: string;
  } | null;
  brc_documents: BrcDocument[];
}

/* ------------------------------------------------------------------ */
/*  Status mapping                                                     */
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getEstadoBadge(status: string) {
  const label = STATUS_LABELS[status] ?? status;
  const style =
    STATUS_BADGE_STYLES[status] ??
    "bg-gray-100 text-gray-600 border border-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}

function getProgressFromDocs(docs: BrcDocument[]) {
  if (docs.length === 0) return 0;
  const completed = docs.filter(
    (d) => d.status === "APROBADO" || d.status === "VALIDADO"
  ).length;
  return Math.round((completed / docs.length) * 100);
}

function getStatusProgress(status: string, docProgress: number) {
  if (status === "CERTIFICADO") return 100;
  if (status === "RECHAZADO") return docProgress;
  if (status === "VALIDACION_NOTARIAL") return Math.max(docProgress, 80);
  if (status === "EN_REVISION") return Math.max(docProgress, 30);
  return docProgress;
}

function getProgressColor(progreso: number) {
  if (progreso >= 100) return "hsl(160 84% 39%)";
  if (progreso >= 60) return "hsl(221 83% 53%)";
  if (progreso >= 30) return "hsl(45 93% 47%)";
  return "hsl(0 72% 51%)";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExpedientesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedExp, setSelectedExp] = useState<Expediente | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [eligibleProps, setEligibleProps] = useState<EligibleProperty[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  useEffect(() => {
    document.body.style.overflow = selectedExp || showNewModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedExp, showNewModal]);

  async function handleOpenNewModal() {
    setShowNewModal(true);
    setLoadingEligible(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("properties")
        .select("id, title, address_line, city, state, price, currency")
        .eq("owner_id", user!.id)
        .eq("brc_status", "NO_SOLICITADO")
        .order("created_at", { ascending: false });
      setEligibleProps((data as EligibleProperty[]) ?? []);
    } catch {
      setEligibleProps([]);
    } finally {
      setLoadingEligible(false);
    }
  }

  const isNotario = user?.role === "NOTARIO";

  /* ---- Fetch expedientes ---- */
  useEffect(() => {
    if (!user) return;

    async function fetchExpedientes() {
      const supabase = createClient();

      let query = supabase
        .from("brc_expedientes")
        .select(
          `
          id,
          property_id,
          status,
          notes,
          created_at,
          assigned_notary_id,
          requested_by,
          properties ( title ),
          notary_profile:profiles!brc_expedientes_assigned_notary_id_fkey ( first_name, last_name ),
          requester_profile:profiles!brc_expedientes_requested_by_fkey ( first_name, last_name ),
          brc_documents (
            id,
            document_type_id,
            file_name,
            status,
            rejection_reason,
            reviewed_at,
            ocr_valid,
            ocr_confidence,
            brc_document_types ( name )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (user!.role === "NOTARIO") {
        query = query.eq("assigned_notary_id", user!.id);
      } else {
        query = query.eq("requested_by", user!.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setExpedientes(data as unknown as Expediente[]);
      }
      setLoading(false);
    }

    fetchExpedientes();
  }, [user]);

  /* ---- Stats ---- */
  const stats = [
    {
      label: isNotario ? "Expedientes Asignados" : "Total Solicitudes",
      value: String(expedientes.length),
      icon: FileText,
      color: "hsl(221 83% 53%)",
      bgColor: "hsl(221 83% 53% / 0.1)",
    },
    {
      label: "En Revision",
      value: String(
        expedientes.filter(
          (e) =>
            e.status === "EN_REVISION" || e.status === "DOCUMENTACION_PENDIENTE"
        ).length
      ),
      icon: Clock,
      color: "hsl(45 93% 47%)",
      bgColor: "hsl(45 93% 47% / 0.1)",
    },
    {
      label: "Certificados",
      value: String(
        expedientes.filter((e) => e.status === "CERTIFICADO").length
      ),
      icon: CheckCircle2,
      color: "hsl(160 84% 39%)",
      bgColor: "hsl(160 84% 39% / 0.1)",
    },
    {
      label: "Rechazados",
      value: String(
        expedientes.filter((e) => e.status === "RECHAZADO").length
      ),
      icon: XCircle,
      color: "hsl(0 72% 51%)",
      bgColor: "hsl(0 72% 51% / 0.1)",
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            {isNotario ? "Expedientes Asignados" : "Expedientes BRC"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isNotario
              ? "Revisa y valida los expedientes de certificacion asignados."
              : "Gestiona tus solicitudes de certificados de bienes raices."}
          </p>
        </div>
        {!isNotario && (
          <button
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva Solicitud
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Stats Cards                                                 */}
      {/* ============================================================ */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div
              className="absolute inset-x-0 top-0 h-1 opacity-80"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            />
            <div className="flex items-center justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm"
                style={{ background: stat.bgColor }}
              >
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-gray-500">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  Empty State                                                 */}
      {/* ============================================================ */}
      {expedientes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
          <Inbox className="h-16 w-16 text-gray-200 mb-4" />
          <h3
            className="text-lg font-bold text-gray-900 mb-1"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            {isNotario ? "Sin expedientes asignados" : "Sin expedientes"}
          </h3>
          <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
            {isNotario
              ? "Aun no tienes expedientes asignados para revision."
              : "Aun no tienes solicitudes de certificacion BRC. Comienza seleccionando una propiedad para certificar."}
          </p>
          {!isNotario && (
            <button
              onClick={handleOpenNewModal}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            >
              <Plus className="h-4 w-4" />
              Crear mi primera solicitud
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Expedientes List                                            */}
      {/* ============================================================ */}
      {isNotario ? (
        /* ── Notary Table View ── */
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr
                  className="text-[11px] font-bold text-white uppercase tracking-wider"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(210 80% 45%))" }}
                >
                  <th className="px-5 py-3">Propiedad</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Docs Recibidos</th>
                  <th className="px-4 py-3">Docs Validados</th>
                  <th className="px-4 py-3 text-center">OCR</th>
                  <th className="px-4 py-3">Docs Rechazados</th>
                  <th className="px-4 py-3 text-center">Progreso</th>
                  <th className="px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expedientes.map((exp) => {
                  const docProgress = getProgressFromDocs(exp.brc_documents);
                  const progreso = getStatusProgress(exp.status, docProgress);
                  const requesterName = exp.requester_profile
                    ? `${exp.requester_profile.first_name} ${exp.requester_profile.last_name}`
                    : "Sin nombre";
                  const propertyTitle = exp.properties?.title ?? "Propiedad";

                  const totalDocs = exp.brc_documents.length;
                  const validados = exp.brc_documents.filter(
                    (d) => d.status === "VALIDADO" || d.status === "APROBADO"
                  ).length;
                  const rechazados = exp.brc_documents.filter(
                    (d) => d.status === "RECHAZADO"
                  ).length;
                  const ocrValidos = exp.brc_documents.filter((d) => d.ocr_valid === true).length;
                  const ocrAltaConfianza = exp.brc_documents.filter(
                    (d) => d.ocr_valid === true && d.ocr_confidence === "high"
                  ).length;

                  return (
                    <tr key={exp.id} className="text-sm hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                            }}
                          >
                            <ShieldBrc className="h-4 w-4" style={{ color: "hsl(221 83% 53%)" }} />
                          </div>
                          <p className="font-bold text-gray-900 truncate max-w-[200px]" style={{ fontFamily: "Barlow, Inter, sans-serif" }}>
                            {propertyTitle}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs">{requesterName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {formatDate(exp.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        {getEstadoBadge(exp.status)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                          {totalDocs}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border ${
                          validados > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}>
                          {validados}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {totalDocs > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${
                              ocrAltaConfianza === totalDocs
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ocrValidos > 0
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-gray-50 text-gray-400 border-gray-200"
                            }`}
                            title={`${ocrAltaConfianza} alta · ${ocrValidos - ocrAltaConfianza} media/baja · ${totalDocs - ocrValidos} sin validar`}
                          >
                            {ocrValidos}/{totalDocs}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border ${
                          rechazados > 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}>
                          {rechazados}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${progreso}%`, background: getProgressColor(progreso) }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-gray-500 w-8 text-right">{progreso}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Link
                          href={`/dashboard/expedientes/${exp.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:opacity-90 hover:shadow-sm"
                          style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                        >
                          Revisar
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Owner Card View ── */
        <div className="space-y-4">
          {expedientes.map((exp) => {
            const docProgress = getProgressFromDocs(exp.brc_documents);
            const progreso = getStatusProgress(exp.status, docProgress);
            const notaryName = exp.notary_profile
              ? `Lic. ${exp.notary_profile.first_name} ${exp.notary_profile.last_name}`
              : "Sin asignar";
            const propertyTitle = exp.properties?.title ?? "Propiedad";

            return (
              <div
                key={exp.id}
                className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
              >
                {/* Main row */}
                <div className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: Property + Date */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background:
                            "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                        }}
                      >
                        <ShieldBrc
                          className="h-5 w-5"
                          style={{ color: "hsl(221 83% 53%)" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h4
                          className="font-bold text-gray-900 truncate"
                          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                        >
                          {propertyTitle}
                        </h4>
                        <p className="mt-0.5 text-sm text-gray-500">
                          Solicitud: {formatDate(exp.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Center: Status + Person */}
                    <div className="flex flex-wrap items-center gap-3">
                      {getEstadoBadge(exp.status)}
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <User className="h-3.5 w-3.5" />
                        {notaryName}
                      </div>
                    </div>

                    {/* Right: Progress + Actions */}
                    <div className="flex items-center gap-4">
                      {/* Progress bar */}
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${progreso}%`,
                              background: getProgressColor(progreso),
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-600 w-10 text-right">
                          {progreso}%
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedExp(exp)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
                        >
                          Ver Expediente
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === exp.id ? null : exp.id)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-all duration-300 hover:bg-gray-50 hover:text-gray-600"
                        >
                          {expandedId === exp.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded: Document Checklist */}
                {expandedId === exp.id && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Checklist de Documentos
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {exp.brc_documents.length > 0 ? (
                        exp.brc_documents.map((doc) => {
                          const completado =
                            doc.status === "APROBADO" || doc.status === "VALIDADO";
                          const rechazado = doc.status === "RECHAZADO";
                          const docName =
                            doc.brc_document_types?.name ?? doc.file_name;
                          return (
                            <div
                              key={doc.id}
                              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                                completado
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : rechazado
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                              }`}
                            >
                              {completado ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : rechazado ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <AlertCircle className="h-4 w-4" />
                              )}
                              {docName}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-400">
                          No se han subido documentos aun.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Nueva Solicitud Modal                                       */}
      {/* ============================================================ */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-6 text-white"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShieldBrc className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold"
                      style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                    >
                      Nueva Solicitud BRC
                    </h3>
                    <p className="text-sm text-white/70">
                      Selecciona una propiedad para certificar
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[calc(80vh-100px)] p-6">
              {loadingEligible ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : eligibleProps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Sin propiedades elegibles
                  </p>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Todas tus propiedades ya tienen certificacion o estan en proceso.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {eligibleProps.map((prop) => (
                    <button
                      key={prop.id}
                      onClick={() => {
                        setShowNewModal(false);
                        router.push(
                          `/dashboard/propiedades/${prop.id}/solicitar-brc`
                        );
                      }}
                      className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background:
                              "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                          }}
                        >
                          <Building2
                            className="h-5 w-5"
                            style={{ color: "hsl(221 83% 53%)" }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 truncate text-sm">
                            {prop.title}
                          </p>
                          {(prop.address_line || prop.city) && (
                            <p className="mt-0.5 text-xs text-gray-500 flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {[prop.address_line, prop.city, prop.state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900">
                            {new Intl.NumberFormat("es-MX", {
                              style: "currency",
                              currency: prop.currency || "MXN",
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }).format(prop.price)}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Expediente Detail Modal                                     */}
      {/* ============================================================ */}
      {selectedExp && (() => {
        const docProgress = getProgressFromDocs(selectedExp.brc_documents);
        const progreso = getStatusProgress(selectedExp.status, docProgress);
        const notaryName = selectedExp.notary_profile
          ? `Lic. ${selectedExp.notary_profile.first_name} ${selectedExp.notary_profile.last_name}`
          : "Sin asignar";
        const propertyTitle = selectedExp.properties?.title ?? "Propiedad";

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedExp(null)}
          >
            <div
              className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="p-6 text-white sticky top-0 z-10"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <ShieldBrc className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{propertyTitle}</h3>
                      <p className="text-sm text-white/70">
                        Expediente BRC #{selectedExp.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedExp(null)}
                    className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <XCircle className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status & Progress */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs text-gray-400 mb-1">Estado</p>
                    {getEstadoBadge(selectedExp.status)}
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs text-gray-400 mb-1">Progreso</p>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${progreso}%`,
                            background: getProgressColor(progreso),
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        {progreso}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-400">
                        Fecha de solicitud
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(selectedExp.created_at)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-400">Notario asignado</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {notaryName}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {selectedExp.notes && (
                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">Notas</p>
                    <p className="text-sm text-gray-700">{selectedExp.notes}</p>
                  </div>
                )}

                {/* Documents Checklist */}
                <div>
                  <h4
                    className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    Documentos del expediente
                  </h4>
                  <div className="space-y-2">
                    {selectedExp.brc_documents.length > 0 ? (
                      selectedExp.brc_documents.map((doc) => {
                        const completado =
                          doc.status === "APROBADO" || doc.status === "VALIDADO";
                        const docName =
                          doc.brc_document_types?.name ?? doc.file_name;
                        return (
                          <div
                            key={doc.id}
                            className={`flex items-center justify-between rounded-xl p-3 transition-colors ${
                              completado ? "bg-emerald-50" : "bg-amber-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                  completado ? "bg-emerald-100" : "bg-amber-100"
                                }`}
                              >
                                {completado ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {docName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {completado
                                    ? "Documento recibido y validado"
                                    : "Pendiente de validacion"}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                completado
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {completado ? "Completado" : "Pendiente"}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl bg-gray-50 p-4 text-center">
                        <p className="text-sm text-gray-400">
                          No se han subido documentos aun.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSelectedExp(null)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                    }}
                  >
                    Subir documentos
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
