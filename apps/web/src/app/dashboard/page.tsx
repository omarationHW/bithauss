"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "./_context/user-context";
import { createClient } from "@/lib/supabase/client";
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
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KpiItem {
  label: string;
  value: string;
  change: string;
  icon: typeof Building2;
}

interface RecentLead {
  id: string;
  nombre: string;
  propiedad: string;
  fecha: string;
  estado: string;
}

interface ChartBar {
  month: string;
  value: number;
}

/* ------------------------------------------------------------------ */
/*  Static action lists (no data dependency)                           */
/* ------------------------------------------------------------------ */

const brokerActions = [
  { label: "Publicar Propiedad", icon: Plus, href: "/dashboard/propiedades", primary: true },
  { label: "Ver Leads", icon: Users, href: "/dashboard/leads", primary: false },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", primary: false },
  { label: "Solicitar BRC", icon: ShieldCheck, href: "/dashboard/expedientes", primary: false },
];

const compradorActions = [
  { label: "Buscar Propiedades", icon: Plus, href: "/propiedades", primary: true },
  { label: "Mis Guardadas", icon: Building2, href: "/dashboard/guardadas", primary: false },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", primary: false },
  { label: "Mis Documentos", icon: FileText, href: "/dashboard/documentos", primary: false },
];

const vendedorActions = [
  { label: "Publicar Propiedad", icon: Plus, href: "/dashboard/propiedades", primary: true },
  { label: "Solicitar BRC", icon: ShieldCheck, href: "/dashboard/expedientes", primary: false },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", primary: false },
  { label: "Mis Documentos", icon: FileText, href: "/dashboard/documentos", primary: false },
];

const notarioActions = [
  { label: "Ver Expedientes Asignados", icon: ShieldCheck, href: "/dashboard/expedientes", primary: true },
  { label: "Certificados Emitidos", icon: FileText, href: "/dashboard/expedientes", primary: false },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", primary: false },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const estadoMap: Record<string, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  EN_NEGOCIACION: "En negociación",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
};

function getEstadoBadge(estado: string) {
  const styles: Record<string, string> = {
    Nuevo: "bg-blue-50 text-blue-600 border border-blue-200",
    Contactado: "bg-amber-50 text-amber-600 border border-amber-200",
    "En negociación": "bg-purple-50 text-purple-600 border border-purple-200",
    Convertido: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    Descartado: "bg-red-50 text-red-600 border border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${styles[estado] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}
    >
      {estado}
    </span>
  );
}

const adminActions = [
  { label: "Gestionar Usuarios", icon: Users, href: "/dashboard/admin/usuarios", primary: true },
  { label: "Verificar Notarios", icon: ShieldCheck, href: "/dashboard/admin/notarios", primary: false },
  { label: "Asignar Expedientes", icon: FileText, href: "/dashboard/admin/asignaciones", primary: false },
  { label: "Ver Propiedades", icon: Building2, href: "/propiedades", primary: false },
];

function getActionsForRole(role: string) {
  if (role === "ADMIN") return adminActions;
  if (role === "COMPRADOR") return compradorActions;
  if (role === "VENDEDOR") return vendedorActions;
  if (role === "NOTARIO") return notarioActions;
  return brokerActions;
}

function isBrokerRole(role: string) {
  return ["BROKER", "INMOBILIARIA", "ADMIN"].includes(role);
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/* ------------------------------------------------------------------ */
/*  Data-fetching hook                                                 */
/* ------------------------------------------------------------------ */

function useDashboardData(userId: string | undefined, role: string) {
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [chartData, setChartData] = useState<ChartBar[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    setLoadingStats(true);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const supabase = createClient();

    async function fetchBrokerData() {
      // 1. Propiedades Activas
      const { count: activeProps } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId!)
        .eq("status", "PUBLICADO");

      // 2. Get user property IDs for lead queries
      const { data: userProperties } = await supabase
        .from("properties")
        .select("id, view_count")
        .eq("owner_id", userId!);

      const propertyIds = (userProperties ?? []).map((p) => p.id);

      // 3. Leads Nuevos (leads on user's properties with status NUEVO)
      let newLeadsCount = 0;
      if (propertyIds.length > 0) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .in("property_id", propertyIds)
          .eq("status", "NUEVO");
        newLeadsCount = count ?? 0;
      }

      // 4. Total Visitas (sum of view_count)
      const totalViews = (userProperties ?? []).reduce(
        (sum, p) => sum + (p.view_count ?? 0),
        0,
      );

      // 5. BRC Certificados
      const { count: brcCount } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId!)
        .eq("brc_status", "CERTIFICADO");

      // 6. Recent leads
      let fetchedLeads: RecentLead[] = [];
      if (propertyIds.length > 0) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name, status, created_at, property_id, properties(title)")
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false })
          .limit(5);

        fetchedLeads = (leadsData ?? []).map((l) => ({
          id: l.id,
          nombre: l.name ?? "Sin nombre",
          propiedad:
            (l.properties as unknown as { title: string } | null)?.title ??
            "Propiedad",
          fecha: new Date(l.created_at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          estado: estadoMap[l.status] ?? l.status,
        }));
      }

      // 7. Chart: leads grouped by month (last 6 months)
      let chart: ChartBar[] = [];
      if (propertyIds.length > 0) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const { data: leadsForChart } = await supabase
          .from("leads")
          .select("created_at")
          .in("property_id", propertyIds)
          .gte("created_at", sixMonthsAgo.toISOString())
          .order("created_at", { ascending: true });

        // Build a map for last 6 months
        const monthMap = new Map<string, number>();
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          monthMap.set(key, 0);
        }

        for (const row of leadsForChart ?? []) {
          const d = new Date(row.created_at);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (monthMap.has(key)) {
            monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
          }
        }

        chart = Array.from(monthMap.entries()).map(([key, value]) => {
          const monthIdx = parseInt(key.split("-")[1] ?? "0", 10);
          return { month: MONTH_LABELS[monthIdx] ?? "N/A", value };
        });
      } else {
        // No properties yet — show empty 6-month chart
        const now = new Date();
        chart = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          return { month: MONTH_LABELS[d.getMonth()] ?? "N/A", value: 0 };
        });
      }

      if (cancelled) return;

      setKpis([
        {
          label: "Propiedades Activas",
          value: String(activeProps ?? 0),
          change: `${propertyIds.length} total`,
          icon: Building2,
        },
        {
          label: "Leads Nuevos",
          value: String(newLeadsCount),
          change: "pendientes",
          icon: Users,
        },
        {
          label: "Total Visitas",
          value: String(totalViews),
          change: "acumuladas",
          icon: Eye,
        },
        {
          label: "BRC Certificados",
          value: String(brcCount ?? 0),
          change: "propiedades",
          icon: ShieldCheck,
        },
      ]);
      setRecentLeads(fetchedLeads);
      setChartData(chart);
      setLoadingStats(false);
    }

    async function fetchVendedorData() {
      const { count: myProps } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId!);

      const { data: userProperties } = await supabase
        .from("properties")
        .select("id, view_count")
        .eq("owner_id", userId!);

      const propertyIds = (userProperties ?? []).map((p) => p.id);
      const totalViews = (userProperties ?? []).reduce(
        (sum, p) => sum + (p.view_count ?? 0),
        0,
      );

      let requestCount = 0;
      if (propertyIds.length > 0) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .in("property_id", propertyIds);
        requestCount = count ?? 0;
      }

      const { count: brcCount } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId!)
        .eq("brc_status", "CERTIFICADO");

      if (cancelled) return;

      setKpis([
        { label: "Mis Propiedades", value: String(myProps ?? 0), change: "publicadas", icon: Building2 },
        { label: "Visitas Recibidas", value: String(totalViews), change: "acumuladas", icon: Eye },
        { label: "Solicitudes de Compra", value: String(requestCount), change: "recibidas", icon: Users },
        { label: "BRC Activos", value: String(brcCount ?? 0), change: "certificados", icon: ShieldCheck },
      ]);
      setChartData([]);
      setRecentLeads([]);
      setLoadingStats(false);
    }

    async function fetchNotarioData() {
      const { count: totalAssigned } = await supabase
        .from("brc_expedientes")
        .select("id", { count: "exact", head: true })
        .eq("assigned_notary_id", userId!);

      const { count: enRevision } = await supabase
        .from("brc_expedientes")
        .select("id", { count: "exact", head: true })
        .eq("assigned_notary_id", userId!)
        .in("status", ["EN_REVISION", "DOCUMENTACION_PENDIENTE"]);

      const { count: certificados } = await supabase
        .from("brc_expedientes")
        .select("id", { count: "exact", head: true })
        .eq("assigned_notary_id", userId!)
        .eq("status", "CERTIFICADO");

      const { count: rechazados } = await supabase
        .from("brc_expedientes")
        .select("id", { count: "exact", head: true })
        .eq("assigned_notary_id", userId!)
        .eq("status", "RECHAZADO");

      if (cancelled) return;

      setKpis([
        { label: "Expedientes Asignados", value: String(totalAssigned ?? 0), change: "asignados", icon: ShieldCheck },
        { label: "En Revision", value: String(enRevision ?? 0), change: "pendientes", icon: Eye },
        { label: "Certificados Emitidos", value: String(certificados ?? 0), change: "emitidos", icon: Building2 },
        { label: "Rechazados", value: String(rechazados ?? 0), change: "rechazados", icon: Users },
      ]);
      setChartData([]);
      setRecentLeads([]);
      setLoadingStats(false);
    }

    async function fetchCompradorData() {
      // Comprador tables are not fully connected yet — show zeros where possible
      if (cancelled) return;

      setKpis([
        { label: "Propiedades Guardadas", value: "0", change: "por conectar", icon: Building2 },
        { label: "Solicitudes Enviadas", value: "0", change: "por conectar", icon: FileText },
        { label: "Propiedades Visitadas", value: "0", change: "por conectar", icon: Eye },
        { label: "Mensajes", value: "0", change: "por conectar", icon: MessageSquare },
      ]);
      setChartData([]);
      setRecentLeads([]);
      setLoadingStats(false);
    }

    setLoadingStats(true);

    if (role === "ADMIN") {
      // Admin sees platform-wide stats
      (async () => {
        const { count: totalUsers } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        const { count: totalProps } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "PUBLICADO");
        const { count: activeExps } = await supabase.from("brc_expedientes").select("id", { count: "exact", head: true }).not("status", "in", "(CERTIFICADO,RECHAZADO)");
        const { count: pendingNotaries } = await supabase.from("notary_profiles").select("id", { count: "exact", head: true }).eq("is_verified", false);

        if (cancelled) return;
        setKpis([
          { label: "Total Usuarios", value: String(totalUsers ?? 0), change: "plataforma", icon: Users },
          { label: "Propiedades Publicadas", value: String(totalProps ?? 0), change: "activas", icon: Building2 },
          { label: "Expedientes Activos", value: String(activeExps ?? 0), change: "en proceso", icon: ShieldCheck },
          { label: "Notarios Pendientes", value: String(pendingNotaries ?? 0), change: "por verificar", icon: FileText },
        ]);
        setChartData([]);
        setRecentLeads([]);
        setLoadingStats(false);
      })();
    } else if (isBrokerRole(role)) {
      fetchBrokerData();
    } else if (role === "VENDEDOR") {
      fetchVendedorData();
    } else if (role === "NOTARIO") {
      fetchNotarioData();
    } else {
      fetchCompradorData();
    }

    return () => {
      cancelled = true;
    };
  }, [userId, role, refreshKey]);

  return { kpis, recentLeads, chartData, loadingStats, refresh };
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { user, loading: loadingUser } = useUser();
  const userName = user?.fullName ?? null;
  const userRole = user?.role ?? "COMPRADOR";

  const { kpis, recentLeads, chartData, loadingStats, refresh } = useDashboardData(
    user?.id,
    userRole,
  );

  const maxChartValue = useMemo(
    () => Math.max(1, ...chartData.map((d) => d.value)),
    [chartData],
  );

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
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loadingStats}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-500 shadow-sm border border-gray-100 transition-all duration-300 hover:bg-gray-50 hover:shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-gray-400 ${loadingStats ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-500 shadow-sm border border-gray-100">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <span className="first-letter:uppercase">{today}</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  KPI Stat Cards                                              */}
      {/* ============================================================ */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {loadingStats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 opacity-80"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                />
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                </div>
              </div>
            ))
          : kpis.map((kpi) => (
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
      {/*  Chart + Quick Actions (chart only for broker roles)         */}
      {/* ============================================================ */}
      <div className={`grid gap-6 ${isBrokerRole(userRole) ? "lg:grid-cols-3" : ""}`}>
        {/* Leads por Mes Chart - only for broker roles */}
        {isBrokerRole(userRole) && (
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

          {loadingStats ? (
            <div className="flex items-center justify-center h-52">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : (
          <div className="flex items-end gap-4 h-52">
            {chartData.map((bar) => {
              const height = maxChartValue > 0 ? (bar.value / maxChartValue) * 160 : 4;
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
          )}
        </div>
        )}

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
            {getActionsForRole(userRole).map((action) => (
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
      {/*  Recent Leads Table (broker only)                            */}
      {/* ============================================================ */}
      {isBrokerRole(userRole) && (
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
              {loadingStats ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" />
                  </td>
                </tr>
              ) : recentLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-gray-400"
                  >
                    Aún no tienes leads. Se mostrarán aquí cuando lleguen.
                  </td>
                </tr>
              ) : (
                recentLeads.map((lead, i) => (
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
                    <Link
                      href="/dashboard/leads"
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:bg-gray-100"
                      style={{ color: "hsl(221 83% 53%)" }}
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ============================================================ */}
      {/*  Membresía Card (broker only)                                */}
      {/* ============================================================ */}
      {isBrokerRole(userRole) && (
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
      )}
    </div>
  );
}
