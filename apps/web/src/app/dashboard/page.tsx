"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Users,
  Eye,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";

const kpis = [
  {
    label: "Propiedades Activas",
    value: "24",
    change: "+3 este mes",
    trend: "up" as const,
    icon: Building2,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    label: "Leads Nuevos",
    value: "18",
    change: "+5 hoy",
    trend: "up" as const,
    icon: Users,
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    label: "Visitas al Perfil",
    value: "342",
    change: "+12%",
    trend: "up" as const,
    icon: Eye,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
  {
    label: "Tasa de Conversion",
    value: "8.5%",
    change: "+0.3%",
    trend: "up" as const,
    icon: TrendingUp,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
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
    nombre: "Ana Garcia Lopez",
    propiedad: "Depto. Polanco 3 Rec.",
    fecha: "4 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 2,
    nombre: "Roberto Hernandez",
    propiedad: "Casa Coyoacan 250m2",
    fecha: "3 Mar 2026",
    estado: "Contactado",
  },
  {
    id: 3,
    nombre: "Maria Fernanda Ruiz",
    propiedad: "Penthouse Santa Fe",
    fecha: "3 Mar 2026",
    estado: "En negociacion",
  },
  {
    id: 4,
    nombre: "Jorge Martinez Soto",
    propiedad: "Local Comercial Roma",
    fecha: "2 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 5,
    nombre: "Patricia Diaz Morales",
    propiedad: "Depto. Condesa 2 Rec.",
    fecha: "1 Mar 2026",
    estado: "Contactado",
  },
];

const recentProperties = [
  {
    id: 1,
    titulo: "Departamento en Polanco, 3 Recamaras",
    precio: "$4,850,000 MXN",
    visitas: 89,
    leads: 6,
    estado: "Activa",
  },
  {
    id: 2,
    titulo: "Casa en Coyoacan, 250m2 de terreno",
    precio: "$7,200,000 MXN",
    visitas: 124,
    leads: 9,
    estado: "Activa",
  },
  {
    id: 3,
    titulo: "Penthouse en Santa Fe con Vista",
    precio: "$12,500,000 MXN",
    visitas: 45,
    leads: 3,
    estado: "Pausada",
  },
];

function getEstadoBadge(estado: string) {
  switch (estado) {
    case "Nuevo":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          {estado}
        </Badge>
      );
    case "Contactado":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          {estado}
        </Badge>
      );
    case "En negociacion":
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
          {estado}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{estado}</Badge>;
  }
}

function getPropertyBadge(estado: string) {
  switch (estado) {
    case "Activa":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          {estado}
        </Badge>
      );
    case "Pausada":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          {estado}
        </Badge>
      );
    case "Borrador":
      return (
        <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
          {estado}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{estado}</Badge>;
  }
}

export default function DashboardPage() {
  const maxChartValue = Math.max(...chartData.map((d) => d.value));

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Bienvenido, Carlos
          </h2>
          <p className="text-muted-foreground">
            Aqui tienes un resumen de tu actividad reciente.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          4 de marzo de 2026
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    kpi.bgColor
                  )}
                >
                  <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {kpi.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "font-medium",
                      kpi.trend === "up"
                        ? "text-emerald-600"
                        : "text-destructive"
                    )}
                  >
                    {kpi.change}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leads por Mes Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Leads por Mes</CardTitle>
            <CardDescription>
              Cantidad de leads recibidos en los ultimos 6 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-48">
              {chartData.map((bar) => (
                <div
                  key={bar.month}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {bar.value}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
                    style={{
                      height: `${(bar.value / maxChartValue) * 140}px`,
                    }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {bar.month}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones Rapidas</CardTitle>
            <CardDescription>
              Accesos directos a funciones frecuentes
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button className="w-full justify-start gap-2" asChild>
              <Link href="/dashboard/propiedades">
                <Plus className="h-4 w-4" />
                Publicar Propiedad
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              asChild
            >
              <Link href="/dashboard/leads">
                <Users className="h-4 w-4" />
                Ver todos los leads
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              asChild
            >
              <Link href="/dashboard/expedientes">
                <ShieldCheck className="h-4 w-4" />
                Solicitar BRC
              </Link>
            </Button>
            <Separator />
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm font-medium">Membresia Activa</p>
              <p className="text-xs text-muted-foreground">
                Plan Broker Pro - Vence el 15 Abr 2026
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Leads Recientes</CardTitle>
            <CardDescription>
              Ultimos leads recibidos en tus propiedades
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/leads">
              Ver todos
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    Nombre
                  </th>
                  <th className="hidden pb-3 pr-4 font-medium text-muted-foreground sm:table-cell">
                    Propiedad
                  </th>
                  <th className="hidden pb-3 pr-4 font-medium text-muted-foreground md:table-cell">
                    Fecha
                  </th>
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="pb-3 font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{lead.nombre}</td>
                    <td className="hidden py-3 pr-4 text-muted-foreground sm:table-cell">
                      {lead.propiedad}
                    </td>
                    <td className="hidden py-3 pr-4 text-muted-foreground md:table-cell">
                      {lead.fecha}
                    </td>
                    <td className="py-3 pr-4">
                      {getEstadoBadge(lead.estado)}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" size="sm">
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Properties */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Propiedades Recientes</h3>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/propiedades">
              Ver todas
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentProperties.map((prop) => (
            <Card key={prop.id} className="overflow-hidden">
              {/* Image Placeholder */}
              <div className="flex h-40 items-center justify-center bg-muted">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <CardContent className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold leading-tight">
                    {prop.titulo}
                  </h4>
                  {getPropertyBadge(prop.estado)}
                </div>
                <p className="mb-3 text-lg font-bold text-primary">
                  {prop.precio}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {prop.visitas} visitas
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {prop.leads} leads
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
