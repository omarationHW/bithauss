"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "./_context/user-context";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  Users,
  Eye,
  ArrowRight,
  Plus,
  CalendarDays,
  Loader2,
  Crown,
  Sparkles,
  MessageSquare,
  FileText,
  RefreshCw,
} from "lucide-react";
import { ShieldBrc } from "@/components/ui/shield-brc";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { CountUp } from "@/components/ui/count-up";
import { FirstStepsChecklist } from "@/components/onboarding/first-steps-checklist";
import { TourReoffer } from "@/components/onboarding/tour-reoffer";
import { isOnboardingRole } from "@/lib/onboarding/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KpiItem {
  label: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Pantalla a la que lleva la tarjeta al hacer clic (si aplica). */
  href?: string;
  /** Texto del enlace, p.ej. "Ver propiedades". */
  hint?: string;
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
  { label: "Solicitar BRC", icon: ShieldBrc, href: "/dashboard/expedientes", primary: false },
];

const compradorActions = [
  { label: "Buscar Propiedades", icon: Plus, href: "/propiedades", primary: true },
  { label: "Mis Guardadas", icon: Building2, href: "/dashboard/guardadas", primary: false },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", primary: false },
];

const vendedorActions = [
  { label: "Publicar Propiedad", icon: Plus, href: "/dashboard/propiedades", primary: true },
  { label: "Solicitar BRC", icon: ShieldBrc, href: "/dashboard/expedientes", primary: false },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", primary: false },
];

const notarioActions = [
  { label: "Ver Expedientes Asignados", icon: ShieldBrc, href: "/dashboard/expedientes", primary: true },
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
  { label: "Verificar Notarios", icon: ShieldBrc, href: "/dashboard/admin/notarios", primary: false },
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
          href: "/dashboard/propiedades",
          hint: "Ver propiedades",
        },
        {
          label: "Leads Nuevos",
          value: String(newLeadsCount),
          change: "pendientes",
          icon: Users,
          href: "/dashboard/leads",
          hint: "Ver leads",
        },
        {
          label: "Total Visitas",
          value: String(totalViews),
          change: "acumuladas",
          icon: Eye,
          href: "/dashboard/propiedades",
          hint: "Ver por propiedad",
        },
        {
          label: "BRC Certificados",
          value: String(brcCount ?? 0),
          change: "propiedades",
          icon: ShieldBrc,
          href: "/dashboard/expedientes",
          hint: "Ver certificados",
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
        { label: "Mis Propiedades", value: String(myProps ?? 0), change: "publicadas", icon: Building2, href: "/dashboard/propiedades", hint: "Ver propiedades" },
        { label: "Visitas Recibidas", value: String(totalViews), change: "acumuladas", icon: Eye, href: "/dashboard/propiedades", hint: "Ver por propiedad" },
        { label: "Solicitudes de Compra", value: String(requestCount), change: "recibidas", icon: Users, href: "/dashboard/leads", hint: "Ver solicitudes" },
        { label: "BRC Activos", value: String(brcCount ?? 0), change: "certificados", icon: ShieldBrc, href: "/dashboard/expedientes", hint: "Ver certificados" },
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
        { label: "Expedientes Asignados", value: String(totalAssigned ?? 0), change: "asignados", icon: ShieldBrc, href: "/dashboard/expedientes", hint: "Ver expedientes" },
        { label: "En Revision", value: String(enRevision ?? 0), change: "pendientes", icon: Eye, href: "/dashboard/expedientes", hint: "Ver pendientes" },
        { label: "Certificados Emitidos", value: String(certificados ?? 0), change: "emitidos", icon: Building2, href: "/dashboard/expedientes", hint: "Ver certificados" },
        { label: "Rechazados", value: String(rechazados ?? 0), change: "rechazados", icon: Users, href: "/dashboard/expedientes", hint: "Ver rechazados" },
      ]);
      setChartData([]);
      setRecentLeads([]);
      setLoadingStats(false);
    }

    async function fetchCompradorData() {
      // Comprador tables are not fully connected yet — show zeros where possible
      if (cancelled) return;

      setKpis([
        { label: "Propiedades Guardadas", value: "0", change: "por conectar", icon: Building2, href: "/dashboard/guardadas", hint: "Ver guardadas" },
        { label: "Solicitudes Enviadas", value: "0", change: "por conectar", icon: FileText, href: "/dashboard/solicitudes", hint: "Ver solicitudes" },
        { label: "Propiedades Visitadas", value: "0", change: "por conectar", icon: Eye },
        { label: "Mensajes", value: "0", change: "por conectar", icon: MessageSquare, href: "/dashboard/mensajes", hint: "Ver mensajes" },
      ]);
      setChartData([]);
      setRecentLeads([]);
      setLoadingStats(false);
    }

    setLoadingStats(true);

    if (role === "ADMIN") {
      // Admin sees platform-wide stats + leads activity (same scope as the leads page)
      (async () => {
        const { count: totalUsers } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        const { count: totalProps } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "PUBLICADO");
        const { count: activeExps } = await supabase.from("brc_expedientes").select("id", { count: "exact", head: true }).not("status", "in", "(CERTIFICADO,RECHAZADO,BORRADOR)");
        const { count: pendingNotaries } = await supabase.from("notary_profiles").select("id", { count: "exact", head: true }).eq("is_verified", false);

        // Recent leads (no owner filter — admin RLS reads platform-wide if allowed,
        // otherwise this returns the admin's own leads, matching /dashboard/leads)
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, name, status, created_at, property_id, properties(title)")
          .order("created_at", { ascending: false })
          .limit(5);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const { data: leadsForChart } = await supabase
          .from("leads")
          .select("created_at")
          .gte("created_at", sixMonthsAgo.toISOString())
          .order("created_at", { ascending: true });

        if (cancelled) return;

        const fetchedLeads: RecentLead[] = (leadsData ?? []).map((l) => ({
          id: l.id,
          nombre: l.name ?? "Sin nombre",
          propiedad:
            (l.properties as unknown as { title: string } | null)?.title ?? "Propiedad",
          fecha: new Date(l.created_at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          estado: estadoMap[l.status] ?? l.status,
        }));

        const monthMap = new Map<string, number>();
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthMap.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
        }
        for (const row of leadsForChart ?? []) {
          const d = new Date(row.created_at);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
        }
        const chart = Array.from(monthMap.entries()).map(([key, value]) => {
          const monthIdx = parseInt(key.split("-")[1] ?? "0", 10);
          return { month: MONTH_LABELS[monthIdx] ?? "N/A", value };
        });

        setKpis([
          { label: "Total Usuarios", value: String(totalUsers ?? 0), change: "plataforma", icon: Users, href: "/dashboard/admin/usuarios", hint: "Gestionar usuarios" },
          { label: "Propiedades Publicadas", value: String(totalProps ?? 0), change: "activas", icon: Building2, href: "/dashboard/propiedades", hint: "Ver propiedades" },
          { label: "Expedientes Activos", value: String(activeExps ?? 0), change: "en proceso", icon: ShieldBrc, href: "/dashboard/expedientes", hint: "Ver expedientes" },
          { label: "Notarios Pendientes", value: String(pendingNotaries ?? 0), change: "por verificar", icon: FileText, href: "/dashboard/admin/notarios", hint: "Verificar notarios" },
        ]);
        setChartData(chart);
        setRecentLeads(fetchedLeads);
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

  return { kpis, recentLeads, chartData, loadingStats, refresh, refreshKey };
}

const HEADING_FONT = { fontFamily: "Barlow, Inter, sans-serif" } as const;
const BRAND_GRADIENT = "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))";

/* ------------------------------------------------------------------ */
/*  KPI card: clicable cuando tiene destino                            */
/* ------------------------------------------------------------------ */

function KpiCard({ kpi }: { kpi: KpiItem }) {
  const clickable = Boolean(kpi.href);
  const hint = kpi.hint ?? "Ver detalle";

  return (
    <SpotlightCard
      href={kpi.href}
      padding="md"
      aria-label={clickable ? `${kpi.label}: ${kpi.value}. ${hint}` : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform duration-300 motion-safe:group-hover:scale-105"
          aria-hidden
        >
          <kpi.icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-gray-100/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {kpi.change}
        </span>
      </div>

      <p className="mt-5 text-sm font-medium text-gray-500">{kpi.label}</p>
      <p
        className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-gray-900"
        style={HEADING_FONT}
      >
        <CountUp value={kpi.value} />
      </p>

      {clickable && (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
          {hint}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      )}
    </SpotlightCard>
  );
}

function KpiSkeleton() {
  return (
    <SpotlightCard padding="md" className="animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="h-11 w-11 rounded-xl bg-gray-100" />
        <div className="h-6 w-20 rounded-full bg-gray-100" />
      </div>
      <div className="mt-5 h-4 w-32 rounded-lg bg-gray-100" />
      <div className="mt-2 h-9 w-16 rounded-lg bg-gray-200" />
      <div className="mt-4 h-4 w-24 rounded-lg bg-gray-100" />
    </SpotlightCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Cabecera de sección dentro de una tarjeta                          */
/* ------------------------------------------------------------------ */

function CardHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-900" style={HEADING_FONT}>
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group/link inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      {children}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-300 motion-safe:group-hover/link:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { user, loading: loadingUser } = useUser();
  const userName = user?.fullName ?? null;
  const userRole = user?.role ?? "COMPRADOR";

  const { kpis, recentLeads, chartData, loadingStats, refresh, refreshKey } = useDashboardData(
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {loadingUser ? (
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              Cargando...
            </h2>
          ) : (
            <h2
              className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              style={HEADING_FONT}
            >
              Bienvenido, {userName}
            </h2>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Aquí tienes un resumen de tu actividad reciente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loadingStats}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200/70 bg-white px-4 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 text-gray-400 ${loadingStats ? "animate-spin" : ""}`}
              aria-hidden
            />
            Actualizar
          </button>
          <div className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/70 px-4 text-sm font-medium text-gray-500 ring-1 ring-gray-200/60">
            <CalendarDays className="h-4 w-4 text-gray-400" aria-hidden />
            <span className="first-letter:uppercase">{today}</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Primeros pasos (solo usuarios que publican, hasta completar) */}
      {/* ============================================================ */}
      {user?.id && isOnboardingRole(userRole) && (
        <>
          <FirstStepsChecklist userId={user.id} refreshKey={refreshKey} />
          <TourReoffer userId={user.id} />
        </>
      )}

      {/* ============================================================ */}
      {/*  KPI Stat Cards                                              */}
      {/* ============================================================ */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {loadingStats
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
      </div>

      {/* ============================================================ */}
      {/*  Chart + Quick Actions (chart only for broker roles)         */}
      {/* ============================================================ */}
      <div className={`grid gap-6 ${isBrokerRole(userRole) ? "lg:grid-cols-3" : ""}`}>
        {/* Leads por Mes Chart - only for broker roles */}
        {isBrokerRole(userRole) && (
          <SpotlightCard padding="md" className="lg:col-span-2">
            <CardHeading
              title="Leads por Mes"
              subtitle="Últimos 6 meses de actividad"
              action={<TextLink href="/dashboard/leads">Ver detalle</TextLink>}
            />

            {loadingStats ? (
              <div className="mt-6 flex h-52 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="mt-6 flex h-52 items-end gap-3 sm:gap-4" role="img" aria-label="Leads recibidos por mes en los últimos 6 meses">
                {chartData.map((bar) => {
                  const height = bar.value > 0 ? Math.max(8, (bar.value / maxChartValue) * 160) : 4;
                  return (
                    <div
                      key={bar.month}
                      className="group/bar flex flex-1 flex-col items-center gap-2"
                      title={`${bar.month}: ${bar.value}`}
                    >
                      <span className="text-xs font-bold tabular-nums text-gray-600 opacity-0 transition-opacity duration-300 group-hover/bar:opacity-100">
                        {bar.value}
                      </span>
                      <div
                        className={`w-full rounded-lg transition-[height,background-color] duration-500 ${
                          bar.value > 0
                            ? "bg-blue-500/85 group-hover/bar:bg-blue-500"
                            : "bg-gray-200"
                        }`}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-xs font-semibold text-gray-400">{bar.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SpotlightCard>
        )}

        {/* Quick Actions */}
        <SpotlightCard padding="md" data-tour="dash:acciones">
          <CardHeading title="Acciones Rápidas" subtitle="Accesos directos" />

          <ul className="mt-5 flex flex-col gap-2">
            {getActionsForRole(userRole).map((action) => (
              <li key={action.label}>
                <Link
                  href={action.href}
                  className={`group/action flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 ${
                    action.primary
                      ? "text-white shadow-sm hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5"
                      : "bg-gray-50/80 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900"
                  }`}
                  style={action.primary ? { background: BRAND_GRADIENT } : undefined}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      action.primary ? "bg-white/20 text-white" : "bg-white text-blue-600 shadow-sm"
                    }`}
                    aria-hidden
                  >
                    <action.icon className="h-4 w-4" />
                  </span>
                  {action.label}
                  <ArrowRight
                    className={`ml-auto h-4 w-4 transition-transform duration-300 motion-safe:group-hover/action:translate-x-0.5 ${
                      action.primary ? "text-white/90" : "text-gray-400"
                    }`}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </SpotlightCard>
      </div>

      {/* ============================================================ */}
      {/*  Recent Leads Table (broker only)                            */}
      {/* ============================================================ */}
      {isBrokerRole(userRole) && (
        <SpotlightCard padding="none">
          <div className="p-6 pb-4">
            <CardHeading
              title="Leads Recientes"
              subtitle="Últimos leads recibidos en tus propiedades"
              action={<TextLink href="/dashboard/leads">Ver todos</TextLink>}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/70 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Nombre
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">
                    Propiedad
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">
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
              <tbody className="divide-y divide-gray-100">
                {loadingStats ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" />
                    </td>
                  </tr>
                ) : recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden>
                        <Users className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-gray-700">Aún no tienes leads</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Se mostrarán aquí cuando lleguen.
                      </p>
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="transition-colors duration-200 hover:bg-gray-50/80"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900">{lead.nombre}</td>
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
                          className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
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
        </SpotlightCard>
      )}

      {/* ============================================================ */}
      {/*  Membresía Card (broker only)                                */}
      {/* ============================================================ */}
      {isBrokerRole(userRole) && (
        <SpotlightCard padding="lg" spotlightColor="hsl(160 84% 39% / 0.12)">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"
                aria-hidden
              >
                <Crown className="h-7 w-7" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900" style={HEADING_FONT}>
                    Membresía Broker Pro
                  </h3>
                  <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                </div>
                <p className="mt-0.5 text-sm text-gray-500">Plan activo - Vence el 15 Abr 2026</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/membresia"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200/70 bg-white px-5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <FileText className="h-4 w-4 text-gray-400" aria-hidden />
                Ver detalles
              </Link>
              <Link
                href="/dashboard/membresia"
                className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
                style={{ background: BRAND_GRADIENT }}
              >
                Renovar Plan
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </SpotlightCard>
      )}
    </div>
  );
}
