"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Eye,
  TrendingUp,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  CalendarDays,
  Loader2,
  Crown,
  Sparkles,
  MessageSquare,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const kpis = [
  {
    label: "Propiedades Activas",
    value: "24",
    change: "+3 este mes",
    icon: Building2,
  },
  {
    label: "Leads Nuevos",
    value: "18",
    change: "+5 hoy",
    icon: Users,
  },
  {
    label: "Visitas al Perfil",
    value: "342",
    change: "+12%",
    icon: Eye,
  },
  {
    label: "Tasa de Conversión",
    value: "8.5%",
    change: "+0.3%",
    icon: TrendingUp,
  },
];

const chartData = [
  { month: "Oct", value: 45 },
  { month: "Nov", value: 62 },
  { month: "Dic", value: 38 },
  { month: "Ene", value: 55 },
  { month: "Feb", value: 72 },
  { month: "Mar", value: 48 },
];

const recentLeads = [
  {
    id: 1,
    nombre: "Ana García López",
    propiedad: "Depto. Polanco 3 Rec.",
    fecha: "4 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 2,
    nombre: "Roberto Hernández",
    propiedad: "Casa Coyoacán 250m2",
    fecha: "3 Mar 2026",
    estado: "Contactado",
  },
  {
    id: 3,
    nombre: "María Fernanda Ruiz",
    propiedad: "Penthouse Santa Fe",
    fecha: "3 Mar 2026",
    estado: "En negociación",
  },
  {
    id: 4,
    nombre: "Jorge Martínez Soto",
    propiedad: "Local Comercial Roma",
    fecha: "2 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 5,
    nombre: "Patricia Díaz Morales",
    propiedad: "Depto. Condesa 2 Rec.",
    fecha: "1 Mar 2026",
    estado: "Contactado",
  },
];

const quickActions = [
  {
    label: "Publicar Propiedad",
    icon: Plus,
    href: "/dashboard/propiedades",
    primary: true,
  },
  {
    label: "Ver Leads",
    icon: Users,
    href: "/dashboard/leads",
    primary: false,
  },
  {
    label: "Mensajes",
    icon: MessageSquare,
    href: "/dashboard/mensajes",
    primary: false,
  },
  {
    label: "Solicitar BRC",
    icon: ShieldCheck,
    href: "/dashboard/expedientes",
    primary: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getEstadoBadge(estado: string) {
  const styles: Record<string, string> = {
    Nuevo: "bg-blue-50 text-blue-600 border border-blue-200",
    Contactado: "bg-amber-50 text-amber-600 border border-amber-200",
    "En negociación": "bg-purple-50 text-purple-600 border border-purple-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${styles[estado] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}
    >
      {estado}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const maxChartValue = Math.max(...chartData.map((d) => d.value));
  const [userName, setUserName] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.first_name) {
          setUserName(
            `${profile.first_name} ${profile.last_name ?? ""}`.trim()
          );
        } else if (user.user_metadata?.first_name) {
          setUserName(
            `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ""}`.trim()
          );
        } else {
          setUserName(user.email ?? "Usuario");
        }
      }
      setLoadingUser(false);
    }
    fetchUser();
  }, []);

  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Welcome Header                                              */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {loadingUser ? (
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              Cargando...
            </h2>
          ) : (
            <h2
              className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Bienvenido, {userName}
            </h2>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Aquí tienes un resumen de tu actividad reciente.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-500 shadow-sm border border-gray-100">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <span className="first-letter:uppercase">{today}</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  KPI Stat Cards                                              */}
      {/* ============================================================ */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            {/* Subtle gradient accent at top */}
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
      {/*  Chart + Quick Actions                                       */}
      {/* ============================================================ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leads por Mes Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Leads por Mes
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Últimos 6 meses de actividad
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className="flex items-center gap-1 text-sm font-semibold transition-colors duration-300 hover:opacity-80"
              style={{ color: "hsl(221 83% 53%)" }}
            >
              Ver detalle
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex items-end gap-4 h-52">
            {chartData.map((bar) => {
              const height = (bar.value / maxChartValue) * 160;
              return (
                <div
                  key={bar.month}
                  className="group flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs font-bold text-gray-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {bar.value}
                  </span>
                  <div
                    className="w-full rounded-xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-md"
                    style={{
                      height: `${height}px`,
                      background:
                        "linear-gradient(180deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      opacity: 0.85,
                    }}
                  />
                  <span className="text-xs font-semibold text-gray-400">
                    {bar.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Acciones Rápidas
          </h3>
          <p className="mt-0.5 mb-5 text-sm text-gray-500">
            Accesos directos
          </p>

          <div className="flex flex-col gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                  action.primary
                    ? "text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
                style={
                  action.primary
                    ? {
                        background:
                          "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      }
                    : undefined
                }
              >
                <action.icon className="h-4 w-4" />
                {action.label}
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Recent Leads Table                                          */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Leads Recientes
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              Últimos leads recibidos en tus propiedades
            </p>
          </div>
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
          >
            Ver todos
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-gray-100 bg-gray-50/50 text-left">
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Nombre
                </th>
                <th className="hidden px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider sm:table-cell">
                  Propiedad
                </th>
                <th className="hidden px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider md:table-cell">
                  Fecha
                </th>
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead, i) => (
                <tr
                  key={lead.id}
                  className={`border-t border-gray-100 transition-colors duration-200 hover:bg-gray-50/80 ${
                    i === recentLeads.length - 1 ? "" : ""
                  }`}
                >
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {lead.nombre}
                  </td>
                  <td className="hidden px-6 py-4 text-gray-500 sm:table-cell">
                    {lead.propiedad}
                  </td>
                  <td className="hidden px-6 py-4 text-gray-500 md:table-cell">
                    {lead.fecha}
                  </td>
                  <td className="px-6 py-4">{getEstadoBadge(lead.estado)}</td>
                  <td className="px-6 py-4">
                    <button
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:bg-gray-100"
                      style={{ color: "hsl(221 83% 53%)" }}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Membresía Card                                              */}
      {/* ============================================================ */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 shadow-sm sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Membresía Broker Pro
                </h3>
                <Sparkles className="h-4 w-4 text-yellow-300" />
              </div>
              <p className="mt-0.5 text-sm text-white/80">
                Plan activo - Vence el 15 Abr 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/membresia"
              className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/30"
            >
              <FileText className="h-4 w-4" />
              Ver detalles
            </Link>
            <Link
              href="/dashboard/membresia"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:shadow-lg"
              style={{ color: "hsl(221 83% 53%)" }}
            >
              Renovar Plan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
