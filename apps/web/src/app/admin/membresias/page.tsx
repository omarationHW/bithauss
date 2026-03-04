"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  DollarSign,
  TrendingDown,
  Heart,
  MoreHorizontal,
  Eye,
  Pencil,
  XCircle,
  RefreshCw,
} from "lucide-react";

type PlanType = "Básico" | "Profesional" | "Enterprise";
type SubscriptionStatus = "Activa" | "Vencida" | "Cancelada";

interface Subscription {
  id: string;
  userName: string;
  userInitials: string;
  plan: PlanType;
  status: SubscriptionStatus;
  startDate: string;
  nextBilling: string;
  amount: string;
}

const planColors: Record<PlanType, string> = {
  Básico: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  Profesional: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Enterprise: "bg-violet-500/10 text-violet-500 border-violet-500/20",
};

const statusColors: Record<SubscriptionStatus, string> = {
  Activa: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Vencida: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Cancelada: "bg-red-500/10 text-red-500 border-red-500/20",
};

const subscriptions: Subscription[] = [
  {
    id: "1",
    userName: "Carlos Mendoza",
    userInitials: "CM",
    plan: "Profesional",
    status: "Activa",
    startDate: "15 Ene 2025",
    nextBilling: "15 Mar 2025",
    amount: "$499 MXN",
  },
  {
    id: "2",
    userName: "Inmobiliaria Torres",
    userInitials: "IT",
    plan: "Enterprise",
    status: "Activa",
    startDate: "01 Dic 2024",
    nextBilling: "01 Mar 2025",
    amount: "$1,999 MXN",
  },
  {
    id: "3",
    userName: "Jorge Martínez",
    userInitials: "JM",
    plan: "Profesional",
    status: "Activa",
    startDate: "10 Feb 2025",
    nextBilling: "10 Mar 2025",
    amount: "$499 MXN",
  },
  {
    id: "4",
    userName: "Sofía Morales",
    userInitials: "SM",
    plan: "Básico",
    status: "Activa",
    startDate: "20 Ene 2025",
    nextBilling: "20 Mar 2025",
    amount: "$199 MXN",
  },
  {
    id: "5",
    userName: "Luis Castillo",
    userInitials: "LC",
    plan: "Básico",
    status: "Vencida",
    startDate: "05 Nov 2024",
    nextBilling: "-",
    amount: "$199 MXN",
  },
  {
    id: "6",
    userName: "Grupo Habitacional MX",
    userInitials: "GH",
    plan: "Enterprise",
    status: "Activa",
    startDate: "15 Oct 2024",
    nextBilling: "15 Mar 2025",
    amount: "$1,999 MXN",
  },
  {
    id: "7",
    userName: "Diego Navarro",
    userInitials: "DN",
    plan: "Profesional",
    status: "Cancelada",
    startDate: "01 Sep 2024",
    nextBilling: "-",
    amount: "$499 MXN",
  },
  {
    id: "8",
    userName: "Valentina Cruz",
    userInitials: "VC",
    plan: "Básico",
    status: "Activa",
    startDate: "28 Feb 2025",
    nextBilling: "28 Mar 2025",
    amount: "$199 MXN",
  },
];

const planCounts: Record<string, number> = {
  todas: subscriptions.length,
  basico: 189,
  profesional: 178,
  enterprise: 45,
};

const planFilterMap: Record<string, PlanType | null> = {
  todas: null,
  basico: "Básico",
  profesional: "Profesional",
  enterprise: "Enterprise",
};

function SubscriptionTable({ data }: { data: Subscription[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Usuario
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Plan
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Fecha Inicio
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
              Próximo Cobro
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Monto
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((sub) => (
            <tr
              key={sub.id}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              {/* User */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {sub.userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{sub.userName}</span>
                </div>
              </td>

              {/* Plan */}
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", planColors[sub.plan])}
                >
                  {sub.plan}
                </Badge>
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", statusColors[sub.status])}
                >
                  {sub.status}
                </Badge>
              </td>

              {/* Start Date */}
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm text-muted-foreground">
                  {sub.startDate}
                </span>
              </td>

              {/* Next Billing */}
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">
                  {sub.nextBilling}
                </span>
              </td>

              {/* Amount */}
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm font-medium">{sub.amount}</span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalle
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Renovar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MembresiasPage() {
  const [activeTab, setActiveTab] = useState("todas");

  const filteredSubscriptions =
    planFilterMap[activeTab] === null
      ? subscriptions
      : subscriptions.filter((s) => s.plan === planFilterMap[activeTab]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Membresías y Suscripciones
        </h2>
        <p className="text-muted-foreground">
          Administra las suscripciones y planes de los usuarios
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Suscriptores Activos</p>
              <p className="text-xl font-bold">412</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MRR</p>
              <p className="text-xl font-bold">$187,500 MXN</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <TrendingDown className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Churn Rate</p>
              <p className="text-xl font-bold">2.3%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Heart className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">LTV Promedio</p>
              <p className="text-xl font-bold">$8,900 MXN</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="todas" className="gap-1.5">
            Todas
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {planCounts.todas}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="basico" className="gap-1.5">
            Básico
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {planCounts.basico}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="profesional" className="gap-1.5">
            Profesional
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {planCounts.profesional}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="gap-1.5">
            Enterprise
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {planCounts.enterprise}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <SubscriptionTable data={filteredSubscriptions} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
