"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../../_context/user-context";
import { ShieldBrc } from '@/components/ui/shield-brc'
import {
  FileText,
  Search,
  Loader2,
  TrendingUp,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  RefreshCw,
  MapPin,
  CalendarDays,
  Files,
  Building2,
  User,
  Eye,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ExpedienteStatus =
  | "SOLICITADO"
  | "EN_REVISION"
  | "EN_PROCESO"
  | "PENDIENTE_FIRMA"
  | "CERTIFICADO"
  | "RECHAZADO"
  | "CANCELADO";

interface PropertyInfo {
  title: string;
  city: string | null;
  state: string | null;
  price: number | null;
}

interface ProfileInfo {
  first_name: string | null;
  last_name: string | null;
}

interface Expediente {
  id: string;
  property_id: string;
  requested_by: string;
  assigned_notary_id: string | null;
  status: ExpedienteStatus;
  tariff_id: string | null;
  notes: string | null;
  created_at: string;
  properties: PropertyInfo;
  broker: ProfileInfo;
  notary: ProfileInfo | null;
  document_count?: number;
}

interface NotaryProfile {
  user_id: string;
  notary_number: string | null;
  state: string | null;
  is_verified: boolean;
  profiles: ProfileInfo;
}

const statusLabels: Record<ExpedienteStatus, string> = {
  SOLICITADO: "Solicitado",
  EN_REVISION: "En Revision",
  EN_PROCESO: "En Proceso",
  PENDIENTE_FIRMA: "Pendiente Firma",
  CERTIFICADO: "Certificado",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado",
};

const statusBadgeStyles: Record<ExpedienteStatus, string> = {
  SOLICITADO: "bg-amber-50 text-amber-700 border-amber-200",
  EN_REVISION: "bg-blue-50 text-blue-700 border-blue-200",
  EN_PROCESO: "bg-indigo-50 text-indigo-700 border-indigo-200",
  PENDIENTE_FIRMA: "bg-purple-50 text-purple-700 border-purple-200",
  CERTIFICADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RECHAZADO: "bg-red-50 text-red-700 border-red-200",
  CANCELADO: "bg-gray-50 text-gray-700 border-gray-200",
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function AsignacionesPage() {
  const { user } = useUser();
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpedienteStatus | "ALL">("ALL");

  // Modal state
  const [modalExpedienteId, setModalExpedienteId] = useState<string | null>(null);
  const [notaries, setNotaries] = useState<NotaryProfile[]>([]);
  const [loadingNotaries, setLoadingNotaries] = useState(false);
  const [assigningNotaryId, setAssigningNotaryId] = useState<string | null>(null);
  const [notarySearch, setNotarySearch] = useState("");

  const supabase = useMemo(() => createClient(), []);

  /* ---------- Fetch expedientes ---------- */
  const fetchExpedientes = useCallback(async () => {
    if (!user || user.role !== "ADMIN") return;

    setLoading(true);
    const { data, error } = await supabase
      .from("brc_expedientes")
      .select(
        `id, property_id, requested_by, assigned_notary_id, status, tariff_id, notes, created_at,
         properties(title, city, state, price),
         broker:profiles!brc_expedientes_requested_by_fkey(first_name, last_name),
         notary:profiles!brc_expedientes_assigned_notary_id_fkey(first_name, last_name)`
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch document counts for all expedientes
      const ids = data.map((e: Record<string, unknown>) => e.id as string);
      let docCounts: Record<string, number> = {};

      if (ids.length > 0) {
        const { data: docs } = await supabase
          .from("brc_documents")
          .select("expediente_id")
          .in("expediente_id", ids);

        if (docs) {
          docCounts = docs.reduce((acc: Record<string, number>, d: Record<string, unknown>) => {
            const eid = d.expediente_id as string;
            acc[eid] = (acc[eid] || 0) + 1;
            return acc;
          }, {});
        }
      }

      setExpedientes(
        (data as unknown as Expediente[]).map((e) => ({
          ...e,
          document_count: docCounts[e.id] || 0,
        }))
      );
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchExpedientes();
  }, [fetchExpedientes]);

  /* ---------- Fetch notaries for modal ---------- */
  async function fetchNotaries() {
    setLoadingNotaries(true);
    const { data, error } = await supabase
      .from("notary_profiles")
      .select("user_id, notary_number, state, is_verified, profiles(first_name, last_name)")
      .eq("is_verified", true);

    if (!error && data) {
      setNotaries(data as unknown as NotaryProfile[]);
    }
    setLoadingNotaries(false);
  }

  function openModal(expedienteId: string) {
    setModalExpedienteId(expedienteId);
    setNotarySearch("");
    fetchNotaries();
  }

  function closeModal() {
    setModalExpedienteId(null);
    setNotaries([]);
    setNotarySearch("");
  }

  /* ---------- Assign notary via API (server-side @Roles enforcement) ---------- */
  async function handleAssignNotary(notaryUserId: string) {
    if (!modalExpedienteId) return;
    setAssigningNotaryId(notaryUserId);

    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/admin/expedientes/${modalExpedienteId}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ notary_id: notaryUserId }),
    });

    if (res.ok) {
      const assignedNotary = notaries.find((n) => n.user_id === notaryUserId);
      setExpedientes((prev) =>
        prev.map((e) =>
          e.id === modalExpedienteId
            ? {
                ...e,
                assigned_notary_id: notaryUserId,
                notary: assignedNotary
                  ? {
                      first_name: assignedNotary.profiles.first_name,
                      last_name: assignedNotary.profiles.last_name,
                    }
                  : null,
              }
            : e
        )
      );
      closeModal();
    }
    setAssigningNotaryId(null);
  }

  /* ---------- Filters ---------- */
  const filtered = useMemo(() => {
    let result = expedientes;

    if (statusFilter !== "ALL") {
      result = result.filter((e) => e.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.properties?.title?.toLowerCase().includes(q) ||
          `${e.broker?.first_name ?? ""} ${e.broker?.last_name ?? ""}`.toLowerCase().includes(q) ||
          `${e.notary?.first_name ?? ""} ${e.notary?.last_name ?? ""}`.toLowerCase().includes(q) ||
          e.properties?.city?.toLowerCase().includes(q) ||
          e.properties?.state?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [expedientes, searchQuery, statusFilter]);

  const sinAsignar = useMemo(() => filtered.filter((e) => !e.assigned_notary_id), [filtered]);
  const asignados = useMemo(() => filtered.filter((e) => !!e.assigned_notary_id), [filtered]);

  /* ---------- Stats ---------- */
  const stats = useMemo(() => {
    return {
      sinAsignar: expedientes.filter((e) => !e.assigned_notary_id).length,
      enProceso: expedientes.filter((e) =>
        ["EN_PROCESO", "EN_REVISION", "PENDIENTE_FIRMA"].includes(e.status)
      ).length,
      certificados: expedientes.filter((e) => e.status === "CERTIFICADO").length,
      total: expedientes.length,
    };
  }, [expedientes]);

  /* ---------- Filtered notaries ---------- */
  const filteredNotaries = useMemo(() => {
    if (!notarySearch.trim()) return notaries;
    const q = notarySearch.toLowerCase();
    return notaries.filter(
      (n) =>
        `${n.profiles?.first_name ?? ""} ${n.profiles?.last_name ?? ""}`.toLowerCase().includes(q) ||
        n.notary_number?.toLowerCase().includes(q) ||
        n.state?.toLowerCase().includes(q)
    );
  }, [notaries, notarySearch]);

  /* ---------- Helpers ---------- */
  function formatName(profile: ProfileInfo | null): string {
    if (!profile) return "Sin asignar";
    return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Sin nombre";
  }

  function formatPrice(price: number | null): string {
    if (!price) return "—";
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(
      price
    );
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  /* ---------- Auth gate ---------- */
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">No tienes permisos para acceder a esta pagina.</p>
      </div>
    );
  }

  /* ---------- Expediente Card ---------- */
  function ExpedienteCard({ exp, showAssign }: { exp: Expediente; showAssign: boolean }) {
    const currentModalTarget = modalExpedienteId === exp.id;

    return (
      <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div
          className="absolute inset-x-0 top-0 h-1 opacity-80"
          style={{
            background: exp.assigned_notary_id
              ? "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))"
              : "linear-gradient(135deg, hsl(35 92% 53%), hsl(14 90% 55%))",
          }}
        />

        {/* Header: Property + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-base font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              {exp.properties?.title ?? "Sin titulo"}
            </h4>
            {(exp.properties?.city || exp.properties?.state) && (
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {[exp.properties?.city, exp.properties?.state].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
          <span
            className={`inline-flex flex-shrink-0 items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              statusBadgeStyles[exp.status] ?? "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {statusLabels[exp.status] ?? exp.status}
          </span>
        </div>

        {/* Details */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span className="truncate">{formatName(exp.broker)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>{formatDate(exp.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>{formatPrice(exp.properties?.price)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Files className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>{exp.document_count ?? 0} documentos</span>
          </div>
        </div>

        {/* Notary info + action */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          {exp.assigned_notary_id && exp.notary ? (
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {(exp.notary.first_name?.[0] ?? "N").toUpperCase()}
                {(exp.notary.last_name?.[0] ?? "").toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">{formatName(exp.notary)}</p>
                <p className="text-[10px] text-gray-400">Notario asignado</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-medium">Sin notario asignado</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/expedientes/${exp.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
            >
              <Eye className="h-3 w-3" />
              Ver
            </Link>
            {showAssign && (
              <button
                onClick={() => openModal(exp.id)}
                disabled={currentModalTarget}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:opacity-90 disabled:opacity-50"
                style={{
                  background: exp.assigned_notary_id
                    ? "linear-gradient(135deg, hsl(221 83% 53%), hsl(200 80% 45%))"
                    : "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {exp.assigned_notary_id ? (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    Reasignar
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3" />
                    Asignar Notario
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Render ---------- */
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Asignacion de Expedientes
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Administra y asigna notarios a los expedientes de certificacion.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sin Asignar", value: stats.sinAsignar, icon: AlertCircle, change: "pendientes" },
          { label: "En Proceso", value: stats.enProceso, icon: Clock, change: "activos" },
          { label: "Certificados", value: stats.certificados, icon: CheckCircle2, change: "completados" },
          { label: "Total Expedientes", value: stats.total, icon: FileText, change: "registrados" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div
              className="absolute inset-x-0 top-0 h-1 opacity-80"
              style={{
                background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            />
            <div className="flex items-center justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm"
                style={{
                  background: "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                }}
              >
                <kpi.icon className="h-5 w-5" style={{ color: "hsl(221 83% 53%)" }} />
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                {kpi.change}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">{loading ? "..." : kpi.value}</p>
              <p className="mt-1 text-sm font-medium text-gray-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por propiedad, broker, notario, ciudad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExpedienteStatus | "ALL")}
          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        >
          <option value="ALL">Todos los estados</option>
          {(Object.keys(statusLabels) as ExpedienteStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">Cargando expedientes...</p>
        </div>
      ) : expedientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-20 shadow-sm">
          <FileText className="h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-400">No hay expedientes registrados.</p>
        </div>
      ) : (
        <>
          {/* Section: Sin Asignar */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Sin Asignar
              </h3>
              <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {sinAsignar.length}
              </span>
            </div>

            {sinAsignar.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                <p className="mt-2 text-sm text-gray-400">
                  {searchQuery || statusFilter !== "ALL"
                    ? "No hay expedientes sin asignar con estos filtros."
                    : "Todos los expedientes tienen notario asignado."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sinAsignar.map((exp) => (
                  <ExpedienteCard key={exp.id} exp={exp} showAssign />
                ))}
              </div>
            )}
          </div>

          {/* Section: Asignados */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <ShieldBrc className="h-4 w-4 text-emerald-600" />
              </div>
              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Asignados
              </h3>
              <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {asignados.length}
              </span>
            </div>

            {asignados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">
                  {searchQuery || statusFilter !== "ALL"
                    ? "No hay expedientes asignados con estos filtros."
                    : "No hay expedientes asignados aun."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {asignados.map((exp) => (
                  <ExpedienteCard key={exp.id} exp={exp} showAssign />
                ))}
              </div>
            )}
          </div>

          {/* Count */}
          <p className="text-sm text-gray-400">
            Mostrando {filtered.length} de {expedientes.length} expedientes
          </p>
        </>
      )}

      {/* Modal: Assign Notary */}
      {modalExpedienteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="border-b border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    Asignar Notario
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Selecciona un notario verificado para este expediente.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Notary search */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar notario por nombre, numero o estado..."
                  value={notarySearch}
                  onChange={(e) => setNotarySearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Modal body */}
            <div className="max-h-80 overflow-y-auto p-4">
              {loadingNotaries ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">Cargando notarios verificados...</p>
                </div>
              ) : filteredNotaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShieldBrc className="h-8 w-8 text-gray-200" />
                  <p className="mt-2 text-sm text-gray-400">
                    {notarySearch
                      ? "No se encontraron notarios con esa busqueda."
                      : "No hay notarios verificados disponibles."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotaries.map((notary) => {
                    const name = `${notary.profiles?.first_name ?? ""} ${notary.profiles?.last_name ?? ""}`.trim() || "Sin nombre";
                    const initials =
                      notary.profiles?.first_name && notary.profiles?.last_name
                        ? `${notary.profiles.first_name[0]}${notary.profiles.last_name[0]}`.toUpperCase()
                        : name.slice(0, 2).toUpperCase();
                    const isAssigning = assigningNotaryId === notary.user_id;

                    // Check if this notary is currently assigned to the modal expediente
                    const currentExp = expedientes.find((e) => e.id === modalExpedienteId);
                    const isCurrentNotary = currentExp?.assigned_notary_id === notary.user_id;

                    return (
                      <button
                        key={notary.user_id}
                        onClick={() => handleAssignNotary(notary.user_id)}
                        disabled={isAssigning || isCurrentNotary}
                        className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                          isCurrentNotary
                            ? "border-emerald-200 bg-emerald-50 cursor-default"
                            : "border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm"
                        } disabled:opacity-60`}
                      >
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{
                            background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                          }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {notary.notary_number && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                No. {notary.notary_number}
                              </span>
                            )}
                            {notary.state && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {notary.state}
                              </span>
                            )}
                          </div>
                        </div>
                        {isAssigning ? (
                          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
                        ) : isCurrentNotary ? (
                          <span className="flex-shrink-0 rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                            Asignado
                          </span>
                        ) : (
                          <span
                            className="flex-shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-white"
                            style={{
                              background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                            }}
                          >
                            Seleccionar
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
