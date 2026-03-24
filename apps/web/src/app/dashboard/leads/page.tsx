"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Mock Data                                                  */
/* ------------------------------------------------------------------ */

type LeadEstado =
  | "Nuevo"
  | "Contactado"
  | "En negociación"
  | "Convertido"
  | "Descartado";

interface Lead {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  propiedad: string;
  fecha: string;
  estado: LeadEstado;
}

const leads: Lead[] = [
  {
    id: 1,
    nombre: "Ana García López",
    email: "ana.garcia@email.com",
    telefono: "+52 55 1234 5678",
    propiedad: "Depto. Polanco 3 Rec.",
    fecha: "4 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 2,
    nombre: "Roberto Hernández Vega",
    email: "roberto.hv@email.com",
    telefono: "+52 55 2345 6789",
    propiedad: "Casa Coyoacán 250m²",
    fecha: "3 Mar 2026",
    estado: "Contactado",
  },
  {
    id: 3,
    nombre: "María Fernanda Ruiz",
    email: "mf.ruiz@email.com",
    telefono: "+52 55 3456 7890",
    propiedad: "Penthouse Santa Fe",
    fecha: "3 Mar 2026",
    estado: "En negociación",
  },
  {
    id: 4,
    nombre: "Jorge Martínez Soto",
    email: "jorge.ms@email.com",
    telefono: "+52 55 4567 8901",
    propiedad: "Local Comercial Roma",
    fecha: "2 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 5,
    nombre: "Patricia Díaz Morales",
    email: "patricia.dm@email.com",
    telefono: "+52 55 5678 9012",
    propiedad: "Depto. Condesa 2 Rec.",
    fecha: "1 Mar 2026",
    estado: "Convertido",
  },
  {
    id: 6,
    nombre: "Fernando Castillo Reyes",
    email: "f.castillo@email.com",
    telefono: "+52 55 6789 0123",
    propiedad: "Casa Pedregal",
    fecha: "28 Feb 2026",
    estado: "En negociación",
  },
  {
    id: 7,
    nombre: "Laura Sánchez Gutiérrez",
    email: "laura.sg@email.com",
    telefono: "+52 55 7890 1234",
    propiedad: "Depto. Narvarte",
    fecha: "27 Feb 2026",
    estado: "Descartado",
  },
  {
    id: 8,
    nombre: "Miguel Ángel Torres",
    email: "ma.torres@email.com",
    telefono: "+52 55 8901 2345",
    propiedad: "Terreno Valle de Bravo",
    fecha: "26 Feb 2026",
    estado: "Contactado",
  },
];

const kpis = [
  {
    label: "Total Leads",
    value: "156",
    change: "+12 este mes",
    icon: Users,
  },
  {
    label: "Nuevos",
    value: "18",
    change: "+5 hoy",
    icon: UserPlus,
  },
  {
    label: "Contactados",
    value: "42",
    change: "+8 esta semana",
    icon: Handshake,
  },
  {
    label: "Convertidos",
    value: "23",
    change: "+3 este mes",
    icon: CheckCircle2,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    document.body.style.overflow = selectedLead ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedLead]);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | LeadEstado>(
    "todos"
  );

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
      {/*  Leads Table                                                  */}
      {/* ============================================================ */}
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
                        <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-all duration-300 hover:bg-emerald-50">
                          <Phone className="h-3.5 w-3.5" />
                        </button>
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

      {/* Lead Detail Modal */}
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
              style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{selectedLead.nombre}</h3>
                  <p className="text-sm text-white/80 mt-0.5">Lead #{selectedLead.id}</p>
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
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Estado</span>
                {getEstadoBadge(selectedLead.estado)}
              </div>

              {/* Contact info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Información de contacto</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Teléfono</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.telefono}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Property */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Propiedad de interés</h4>
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))" }}
                  >
                    <Eye className="h-4 w-4" style={{ color: "hsl(221 83% 53%)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedLead.propiedad}</p>
                    <p className="text-xs text-gray-400">Recibido el {selectedLead.fecha}</p>
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
                <a
                  href={`tel:${selectedLead.telefono.replace(/\s/g, "")}`}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  <Phone className="h-4 w-4" />
                  Llamar
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
