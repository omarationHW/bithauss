import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Building2,
  ShieldCheck,
  DollarSign,
  Briefcase,
  Scale,
  UserPlus,
  FileCheck,
  CreditCard,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileText,
} from "lucide-react";

const kpiCards = [
  {
    title: "Usuarios Totales",
    value: "1,247",
    change: "+89 este mes",
    icon: Users,
    trend: "up" as const,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Propiedades Activas",
    value: "3,456",
    change: "+234",
    icon: Building2,
    trend: "up" as const,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "BRC Expedientes",
    value: "456",
    change: "87 pendientes",
    icon: ShieldCheck,
    trend: "neutral" as const,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    title: "Ingresos del Mes",
    value: "$234,500 MXN",
    change: "+12%",
    icon: DollarSign,
    trend: "up" as const,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Brokers Activos",
    value: "523",
    change: "",
    icon: Briefcase,
    trend: "neutral" as const,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    title: "Notarios Registrados",
    value: "48",
    change: "",
    icon: Scale,
    trend: "neutral" as const,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
];

const recentActivity = [
  {
    icon: UserPlus,
    text: "Nuevo broker registrado: María González",
    time: "Hace 5 min",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileCheck,
    text: "BRC expediente #456 certificado por Not. Ramírez",
    time: "Hace 12 min",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: CreditCard,
    text: "Membresía Pro activada - Inmobiliaria Torres",
    time: "Hace 25 min",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: AlertTriangle,
    text: "BRC expediente #452 requiere revisión adicional",
    time: "Hace 45 min",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Building2,
    text: "Nueva propiedad publicada: Depto. en Polanco",
    time: "Hace 1 hora",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: CheckCircle2,
    text: "Notario Lic. Pérez completó validación de 3 expedientes",
    time: "Hace 2 horas",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: UserPlus,
    text: "Nuevo vendedor registrado: Roberto Sánchez",
    time: "Hace 3 horas",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: CreditCard,
    text: "Renovación de membresía Enterprise - Grupo Habitacional MX",
    time: "Hace 4 horas",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

const quickActions = [
  {
    label: "Revisar BRC Pendientes",
    href: "/admin/brc",
    icon: ShieldCheck,
    badge: "87",
    badgeColor: "bg-amber-500 text-white",
  },
  {
    label: "Gestionar Notarios",
    href: "/admin/notarios",
    icon: Scale,
  },
  {
    label: "Ver Reportes",
    href: "/admin/reportes",
    icon: FileText,
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Panel de Administración
        </h2>
        <p className="text-muted-foreground">
          Resumen general de la plataforma BitHauss
        </p>
      </div>

      {/* KPI Cards - 2 rows of 3 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  {kpi.change && (
                    <div className="flex items-center gap-1">
                      {kpi.trend === "up" && (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      )}
                      {kpi.trend === "neutral" && (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          "text-xs",
                          kpi.trend === "up"
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {kpi.change}
                      </span>
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg",
                    kpi.bg
                  )}
                >
                  <kpi.icon className={cn("h-6 w-6", kpi.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section: Activity Feed + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentActivity.map((item, index) => (
              <div key={index}>
                <div className="flex items-start gap-3 py-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      item.bg
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.time}
                    </p>
                  </div>
                </div>
                {index < recentActivity.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-3 px-4"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{action.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {action.badge && (
                      <Badge
                        className={cn(
                          "text-[10px]",
                          action.badgeColor
                        )}
                      >
                        {action.badge}
                      </Badge>
                    )}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              </Link>
            ))}

            <Separator className="my-4" />

            {/* Platform Stats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Estadísticas de Hoy
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Nuevos registros</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Propiedades publicadas</span>
                  <span className="font-medium">8</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">BRC procesados</span>
                  <span className="font-medium">5</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Visitas a la plataforma</span>
                  <span className="font-medium">1,432</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
