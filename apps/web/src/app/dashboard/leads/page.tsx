"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Handshake,
  CheckCircle2,
  Search,
  Eye,
  Phone,
  Download,
  TrendingUp,
  XCircle,
  MessageSquare,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../_context/user-context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DbStatus =
  | "NUEVO"
  | "CONTACTADO"
  | "EN_NEGOCIACION"
  | "CONVERTIDO"
  | "DESCARTADO";

type LeadEstado =
  | "Nuevo"
  | "Contactado"
  | "En negociación"
  | "Convertido"
  | "Descartado";

interface Lead {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string | null;
  propiedad: string;
  propertyId: string | null;
  fecha: string;
  dbStatus: DbStatus;
  estado: LeadEstado;
  source: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<DbStatus, LeadEstado> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  EN_NEGOCIACION: "En negociación",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
};

const DISPLAY_TO_DB: Record<LeadEstado, DbStatus> = {
  Nuevo: "NUEVO",
  Contactado: "CONTACTADO",
  "En negociación": "EN_NEGOCIACION",
  Convertido: "CONVERTIDO",
  Descartado: "DESCARTADO",
};

const STATUS_FLOW: DbStatus[] = [
  "NUEVO",
  "CONTACTADO",
  "EN_NEGOCIACION",
  "CONVERTIDO",
];

function getEstadoBadge(estado: LeadEstado) {
  const styles: Record<LeadEstado, string> = {
    Nuevo: "bg-blue-50 text-blue-600 border-blue-200",
    Contactado: "bg-amber-50 text-amber-600 border-amber-200",
    "En negociación": "bg-purple-50 text-purple-600 border-purple-200",
    Convertido: "bg-emerald-50 text-emerald-600 border-emerald-200",
    Descartado: "bg-red-50 text-red-400 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${styles[estado]}`}
    >
      {estado}
    </span>
  );
}

function formatDateEs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeadsPage() {
  const { user } = useUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | LeadEstado>(
    "todos"
  );

  /* ---- Fetch leads ---- */
  const fetchLeads = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("leads")
      .select("*, properties(title)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
      setLoading(false);
      return;
    }

    const mapped: Lead[] = (data ?? []).map((row: any) => ({
      id: row.id,
      nombre: row.name,
      email: row.email,
      telefono: row.phone ?? "",
      mensaje: row.message ?? null,
      propiedad: row.properties?.title ?? "Sin propiedad",
      propertyId: row.property_id,
      fecha: formatDateEs(row.created_at),
      dbStatus: row.status as DbStatus,
      estado: STATUS_MAP[row.status as DbStatus] ?? "Nuevo",
      source: row.source,
      createdAt: row.created_at,
    }));

    setLeads(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  /* ---- Body scroll lock ---- */
  useEffect(() => {
    document.body.style.overflow = selectedLead ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedLead]);

  /* ---- Update status ---- */
  const handleStatusChange = async (lead: Lead, newDbStatus: DbStatus) => {
    setUpdatingStatus(lead.id);
    const supabase = createClient();

    const { error } = await supabase
      .from("leads")
      .update({ status: newDbStatus, updated_at: new Date().toISOString() })
      .eq("id", lead.id);

    if (error) {
      console.error("Error updating lead status:", error);
      setUpdatingStatus(null);
      return;
    }

    const updated: Lead = {
      ...lead,
      dbStatus: newDbStatus,
      estado: STATUS_MAP[newDbStatus],
    };

    setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));

    if (selectedLead?.id === lead.id) {
      setSelectedLead(updated);
    }

    setUpdatingStatus(null);
  };

  /* ---- KPIs from real data ---- */
  const kpis = [
    {
      label: "Total Leads",
      value: leads.length.toString(),
      change: `${leads.length} total`,
      icon: Users,
    },
    {
      label: "Nuevos",
      value: leads.filter((l) => l.dbStatus === "NUEVO").length.toString(),
      change: "pendientes",
      icon: UserPlus,
    },
    {
      label: "Contactados",
      value: leads
        .filter((l) => l.dbStatus === "CONTACTADO")
        .length.toString(),
      change: "en seguimiento",
      icon: Handshake,
    },
    {
      label: "Convertidos",
      value: leads
        .filter((l) => l.dbStatus === "CONVERTIDO")
        .length.toString(),
      change: "cerrados",
      icon: CheckCircle2,
    },
  ];

  /* ---- Filter & search ---- */
  const filtered = leads.filter((lead) => {
    if (filtroEstado !== "todos" && lead.estado !== filtroEstado) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        lead.nombre.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.propiedad.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const estadoOptions: ("todos" | LeadEstado)[] = [
    "todos",
    "Nuevo",
    "Contactado",
    "En negociación",
    "Convertido",
    "Descartado",
  ];

  /* ---- Next possible statuses for a lead ---- */
  function getNextStatuses(current: DbStatus): DbStatus[] {
    const idx = STATUS_FLOW.indexOf(current);
    const options: DbStatus[] = [];
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
      options.push(STATUS_FLOW[idx + 1]!);
    }
    if (current !== "DESCARTADO") {
      options.push("DESCARTADO");
    }
    return options;
  }

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="mt-3 text-sm text-gray-500">Cargando leads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Header                                                       */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Gestión de Leads
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Da seguimiento a todos tus prospectos de clientes.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-300 hover:bg-gray-50 hover:shadow-md">
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* ============================================================ */}
      {/*  KPI Cards                                                    */}
      {/* ============================================================ */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
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
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                }}
              >
                <kpi.icon
                  className="h-5 w-5"
                  style={{ color: "hsl(221 83% 53%)" }}
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                {kpi.change}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
              <p className="mt-1 text-sm font-medium text-gray-500">
                {kpi.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  Filters                                                      */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o propiedad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) =>
            setFiltroEstado(e.target.value as "todos" | LeadEstado)
          }
          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 outline-none transition-all duration-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        >
          {estadoOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "todos" ? "Todos los estados" : opt}
            </option>
          ))}
        </select>
      </div>

      {/* ============================================================ */}
      {/*  Empty state (no leads at all)                                */}
      {/* ============================================================ */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-20 shadow-sm">
          <Users className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">
            Aún no tienes leads
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-400">
            Cuando alguien se interese en tus propiedades, sus datos aparecerán
            aquí.
          </p>
        </div>
      ) : (
        /* ============================================================ */
        /*  Leads Table                                                  */
        /* ============================================================ */
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Users className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">
                  No se encontraron leads con los filtros seleccionados
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Nombre
                    </th>
                    <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">
                      Email
                    </th>
                    <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">
                      Teléfono
                    </th>
                    <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">
                      Propiedad
                    </th>
                    <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-gray-100 transition-colors duration-200 hover:bg-gray-50/80"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {lead.nombre}
                        </p>
                        <p className="text-xs text-gray-400 md:hidden">
                          {lead.email}
                        </p>
                      </td>
                      <td className="hidden px-6 py-4 text-gray-500 md:table-cell">
                        {lead.email}
                      </td>
                      <td className="hidden px-6 py-4 text-gray-500 lg:table-cell">
                        {lead.telefono}
                      </td>
                      <td className="hidden px-6 py-4 text-gray-500 sm:table-cell">
                        {lead.propiedad}
                      </td>
                      <td className="hidden px-6 py-4 text-gray-500 xl:table-cell">
                        {lead.fecha}
                      </td>
                      <td className="px-6 py-4">
                        {getEstadoBadge(lead.estado)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:bg-gray-100"
                            style={{ color: "hsl(221 83% 53%)" }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {lead.telefono && (
                            <a
                              href={`tel:${lead.telefono.replace(/\s/g, "")}`}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-all duration-300 hover:bg-emerald-50"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer count */}
          <div className="border-t border-gray-100 px-6 py-3 text-sm text-gray-500">
            Mostrando {filtered.length} de {leads.length} leads
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Lead Detail Modal                                            */}
      {/* ============================================================ */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl animate-fade-in-up overflow-hidden"
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
                <div>
                  <h3 className="text-lg font-bold">{selectedLead.nombre}</h3>
                  <p className="text-sm text-white/80 mt-0.5">
                    {selectedLead.source
                      ? `Fuente: ${selectedLead.source}`
                      : "Lead"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <XCircle className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Status with change options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Estado actual
                  </span>
                  {getEstadoBadge(selectedLead.estado)}
                </div>

                {/* Status change buttons */}
                {getNextStatuses(selectedLead.dbStatus).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-400 self-center mr-1">
                      Cambiar a:
                    </span>
                    {getNextStatuses(selectedLead.dbStatus).map((nextStatus) => (
                      <button
                        key={nextStatus}
                        disabled={updatingStatus === selectedLead.id}
                        onClick={() =>
                          handleStatusChange(selectedLead, nextStatus)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:shadow-sm disabled:opacity-50 ${
                          nextStatus === "DESCARTADO"
                            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {updatingStatus === selectedLead.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {STATUS_MAP[nextStatus]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Información de contacto
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedLead.email}
                      </p>
                    </div>
                  </div>
                  {selectedLead.telefono && (
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Teléfono</p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLead.telefono}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              {selectedLead.mensaje && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Mensaje
                  </h4>
                  <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600 leading-relaxed">
                    {selectedLead.mensaje}
                  </p>
                </div>
              )}

              {/* Property */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Propiedad de interés
                </h4>
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                    }}
                  >
                    <Eye
                      className="h-4 w-4"
                      style={{ color: "hsl(221 83% 53%)" }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedLead.propiedad}
                    </p>
                    <p className="text-xs text-gray-400">
                      Recibido el {selectedLead.fecha}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
                >
                  <MessageSquare className="h-4 w-4" />
                  Enviar email
                </a>
                {selectedLead.telefono && (
                  <a
                    href={`tel:${selectedLead.telefono.replace(/\s/g, "")}`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                    }}
                  >
                    <Phone className="h-4 w-4" />
                    Llamar
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
