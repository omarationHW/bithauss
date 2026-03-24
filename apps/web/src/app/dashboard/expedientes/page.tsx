"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Mock data                                                  */
/* ------------------------------------------------------------------ */

interface Documento {
  nombre: string;
  completado: boolean;
}

interface Expediente {
  id: number;
  propiedad: string;
  fechaSolicitud: string;
  estado: string;
  notario: string;
  progreso: number;
  documentos: Documento[];
}

const stats = [
  {
    label: "Total Solicitudes",
    value: "12",
    icon: FileText,
    color: "hsl(221 83% 53%)",
    bgColor: "hsl(221 83% 53% / 0.1)",
  },
  {
    label: "En Revision",
    value: "4",
    icon: Clock,
    color: "hsl(45 93% 47%)",
    bgColor: "hsl(45 93% 47% / 0.1)",
  },
  {
    label: "Certificados",
    value: "6",
    icon: CheckCircle2,
    color: "hsl(160 84% 39%)",
    bgColor: "hsl(160 84% 39% / 0.1)",
  },
  {
    label: "Rechazados",
    value: "2",
    icon: XCircle,
    color: "hsl(0 72% 51%)",
    bgColor: "hsl(0 72% 51% / 0.1)",
  },
];

const expedientes: Expediente[] = [
  {
    id: 1,
    propiedad: "Depto. Polanco 3 Rec.",
    fechaSolicitud: "15 Feb 2026",
    estado: "En Revision",
    notario: "Lic. Carlos Mendoza",
    progreso: 65,
    documentos: [
      { nombre: "Escritura", completado: true },
      { nombre: "INE", completado: true },
      { nombre: "Boleta Predial", completado: true },
      { nombre: "Recibo de Agua", completado: false },
      { nombre: "CFE", completado: true },
    ],
  },
  {
    id: 2,
    propiedad: "Casa Coyoacan 250m2",
    fechaSolicitud: "20 Feb 2026",
    estado: "Documentacion Pendiente",
    notario: "Lic. Ana Martinez",
    progreso: 40,
    documentos: [
      { nombre: "Escritura", completado: true },
      { nombre: "INE", completado: true },
      { nombre: "Boleta Predial", completado: false },
      { nombre: "Recibo de Agua", completado: false },
      { nombre: "CFE", completado: false },
    ],
  },
  {
    id: 3,
    propiedad: "Penthouse Santa Fe",
    fechaSolicitud: "1 Mar 2026",
    estado: "Validacion Notarial",
    notario: "Lic. Roberto Juarez",
    progreso: 85,
    documentos: [
      { nombre: "Escritura", completado: true },
      { nombre: "INE", completado: true },
      { nombre: "Boleta Predial", completado: true },
      { nombre: "Recibo de Agua", completado: true },
      { nombre: "CFE", completado: true },
    ],
  },
  {
    id: 4,
    propiedad: "Local Comercial Roma",
    fechaSolicitud: "5 Ene 2026",
    estado: "Certificado",
    notario: "Lic. Patricia Gomez",
    progreso: 100,
    documentos: [
      { nombre: "Escritura", completado: true },
      { nombre: "INE", completado: true },
      { nombre: "Boleta Predial", completado: true },
      { nombre: "Recibo de Agua", completado: true },
      { nombre: "CFE", completado: true },
    ],
  },
  {
    id: 5,
    propiedad: "Depto. Condesa 2 Rec.",
    fechaSolicitud: "10 Dic 2025",
    estado: "Rechazado",
    notario: "Lic. Fernando Rios",
    progreso: 30,
    documentos: [
      { nombre: "Escritura", completado: true },
      { nombre: "INE", completado: false },
      { nombre: "Boleta Predial", completado: false },
      { nombre: "Recibo de Agua", completado: false },
      { nombre: "CFE", completado: false },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getEstadoBadge(estado: string) {
  const styles: Record<string, string> = {
    "En Revision": "bg-blue-50 text-blue-600 border border-blue-200",
    "Documentacion Pendiente":
      "bg-amber-50 text-amber-600 border border-amber-200",
    "Validacion Notarial":
      "bg-purple-50 text-purple-600 border border-purple-200",
    Certificado: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    Rechazado: "bg-red-50 text-red-600 border border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${styles[estado] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}
    >
      {estado}
    </span>
  );
}

function getProgressColor(progreso: number) {
  if (progreso >= 100) return "hsl(160 84% 39%)";
  if (progreso >= 60) return "hsl(221 83% 53%)";
  if (progreso >= 30) return "hsl(45 93% 47%)";
  return "hsl(0 72% 51%)";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExpedientesPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedExp, setSelectedExp] = useState<Expediente | null>(null);

  useEffect(() => {
    document.body.style.overflow = selectedExp ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedExp]);

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
            Expedientes BRC
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona tus solicitudes de certificados de bienes raices.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva Solicitud
        </button>
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
      {/*  Expedientes List                                            */}
      {/* ============================================================ */}
      <div className="space-y-4">
        {expedientes.map((exp) => (
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
                    <ShieldCheck
                      className="h-5 w-5"
                      style={{ color: "hsl(221 83% 53%)" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4
                      className="font-bold text-gray-900 truncate"
                      style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                    >
                      {exp.propiedad}
                    </h4>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Solicitud: {exp.fechaSolicitud}
                    </p>
                  </div>
                </div>

                {/* Center: Status + Notary */}
                <div className="flex flex-wrap items-center gap-3">
                  {getEstadoBadge(exp.estado)}
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <User className="h-3.5 w-3.5" />
                    {exp.notario}
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
                          width: `${exp.progreso}%`,
                          background: getProgressColor(exp.progreso),
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-10 text-right">
                      {exp.progreso}%
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
                  {exp.documentos.map((doc) => (
                    <div
                      key={doc.nombre}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                        doc.completado
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {doc.completado ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {doc.nombre}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Expediente Detail Modal */}
      {selectedExp && (
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
              style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedExp.propiedad}</h3>
                    <p className="text-sm text-white/70">Expediente BRC #{selectedExp.id}</p>
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
                  {getEstadoBadge(selectedExp.estado)}
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-400 mb-1">Progreso</p>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${selectedExp.progreso}%`,
                          background: getProgressColor(selectedExp.progreso),
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{selectedExp.progreso}%</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs text-gray-400">Fecha de solicitud</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{selectedExp.fechaSolicitud}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs text-gray-400">Notario asignado</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{selectedExp.notario}</p>
                </div>
              </div>

              {/* Documents Checklist */}
              <div>
                <h4
                  className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Documentos del expediente
                </h4>
                <div className="space-y-2">
                  {selectedExp.documentos.map((doc) => (
                    <div
                      key={doc.nombre}
                      className={`flex items-center justify-between rounded-xl p-3 transition-colors ${
                        doc.completado ? "bg-emerald-50" : "bg-amber-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            doc.completado ? "bg-emerald-100" : "bg-amber-100"
                          }`}
                        >
                          {doc.completado ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {doc.completado ? "Documento recibido y validado" : "Pendiente de carga"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          doc.completado
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {doc.completado ? "Completado" : "Pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4
                  className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Historial
                </h4>
                <div className="space-y-3">
                  {[
                    { fecha: selectedExp.fechaSolicitud, accion: "Solicitud BRC creada", actor: "Sistema" },
                    { fecha: selectedExp.fechaSolicitud, accion: "Documentos iniciales cargados", actor: "Usuario" },
                    { fecha: "20 Feb 2026", accion: "Asignado a " + selectedExp.notario, actor: "Sistema" },
                    ...(selectedExp.progreso > 50
                      ? [{ fecha: "25 Feb 2026", accion: "Revisión documental iniciada", actor: selectedExp.notario }]
                      : []),
                    ...(selectedExp.progreso >= 85
                      ? [{ fecha: "5 Mar 2026", accion: "Validación notarial en proceso", actor: selectedExp.notario }]
                      : []),
                    ...(selectedExp.progreso === 100
                      ? [{ fecha: "10 Mar 2026", accion: "Certificado BRC emitido", actor: "Sistema" }]
                      : []),
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="h-2.5 w-2.5 rounded-full mt-1.5"
                          style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                        />
                        {i < 3 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-sm font-medium text-gray-900">{item.accion}</p>
                        <p className="text-xs text-gray-400">{item.fecha} · {item.actor}</p>
                      </div>
                    </div>
                  ))}
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
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  Subir documentos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
