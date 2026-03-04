"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  UserPlus,
  FileCheck,
  XCircle,
  Timer,
  TrendingUp,
  Scale,
  ShieldCheck,
} from "lucide-react";

type BRCStatus =
  | "Pendiente"
  | "En Revisión"
  | "Validación Notarial"
  | "Certificado"
  | "Rechazado";

interface Expediente {
  id: string;
  property: string;
  applicant: string;
  notary: string | null;
  date: string;
  status: BRCStatus;
}

const statusColors: Record<BRCStatus, string> = {
  Pendiente: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "En Revisión": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Validación Notarial": "bg-violet-500/10 text-violet-500 border-violet-500/20",
  Certificado: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Rechazado: "bg-red-500/10 text-red-500 border-red-500/20",
};

const expedientes: Expediente[] = [
  {
    id: "BRC-456",
    property: "Casa en Coyoacán, CDMX",
    applicant: "Carlos Mendoza",
    notary: "Lic. Ramírez Pérez",
    date: "28 Feb 2025",
    status: "Certificado",
  },
  {
    id: "BRC-455",
    property: "Depto. en Polanco, CDMX",
    applicant: "María González",
    notary: "Lic. Torres Vega",
    date: "27 Feb 2025",
    status: "Validación Notarial",
  },
  {
    id: "BRC-454",
    property: "Terreno en Querétaro",
    applicant: "Roberto Hernández",
    notary: null,
    date: "26 Feb 2025",
    status: "Pendiente",
  },
  {
    id: "BRC-453",
    property: "Oficina en Santa Fe, CDMX",
    applicant: "Inmobiliaria Torres",
    notary: "Lic. García Morales",
    date: "25 Feb 2025",
    status: "En Revisión",
  },
  {
    id: "BRC-452",
    property: "Casa en San Pedro, MTY",
    applicant: "Fernando López",
    notary: null,
    date: "24 Feb 2025",
    status: "Rechazado",
  },
  {
    id: "BRC-451",
    property: "Depto. en Condesa, CDMX",
    applicant: "Sofía Morales",
    notary: "Lic. Ramírez Pérez",
    date: "23 Feb 2025",
    status: "Certificado",
  },
  {
    id: "BRC-450",
    property: "Local Comercial en GDL",
    applicant: "Jorge Martínez",
    notary: null,
    date: "22 Feb 2025",
    status: "Pendiente",
  },
  {
    id: "BRC-449",
    property: "Casa en Valle Real, GDL",
    applicant: "Grupo Habitacional MX",
    notary: "Lic. Cruz Ortega",
    date: "21 Feb 2025",
    status: "Validación Notarial",
  },
  {
    id: "BRC-448",
    property: "Penthouse en Interlomas",
    applicant: "Luis Castillo",
    notary: "Lic. Torres Vega",
    date: "20 Feb 2025",
    status: "En Revisión",
  },
  {
    id: "BRC-447",
    property: "Bodega Industrial, Edo. Mex.",
    applicant: "Diego Navarro",
    notary: null,
    date: "19 Feb 2025",
    status: "Pendiente",
  },
];

const tabCounts: Record<string, number> = {
  todos: 456,
  pendientes: 87,
  revision: 34,
  notarial: 12,
  certificados: 298,
  rechazados: 25,
};

const tabStatusMap: Record<string, BRCStatus | null> = {
  todos: null,
  pendientes: "Pendiente",
  revision: "En Revisión",
  notarial: "Validación Notarial",
  certificados: "Certificado",
  rechazados: "Rechazado",
};

function ExpedienteTable({ data }: { data: Expediente[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              #ID
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Propiedad
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Solicitante
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
              Notario Asignado
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Fecha
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Estado
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((exp) => (
            <tr
              key={exp.id}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <span className="text-sm font-mono font-medium">{exp.id}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm">{exp.property}</span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm text-muted-foreground">
                  {exp.applicant}
                </span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {exp.notary ? (
                  <div className="flex items-center gap-2">
                    <Scale className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{exp.notary}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    Sin asignar
                  </span>
                )}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm text-muted-foreground">
                  {exp.date}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", statusColors[exp.status])}
                >
                  {exp.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Expediente
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Asignar Notario
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FileCheck className="mr-2 h-4 w-4" />
                      Aprobar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <XCircle className="mr-2 h-4 w-4" />
                      Rechazar
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

export default function BRCExpedientesPage() {
  const [activeTab, setActiveTab] = useState("todos");

  const filteredExpedientes =
    tabStatusMap[activeTab] === null
      ? expedientes
      : expedientes.filter((e) => e.status === tabStatusMap[activeTab]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Expedientes BRC
        </h2>
        <p className="text-muted-foreground">
          Gestiona los expedientes de Blockchain Registry Certificate
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <ShieldCheck className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expedientes</p>
              <p className="text-xl font-bold">456</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-xl font-bold">87</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Timer className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tiempo Prom. Certificación</p>
              <p className="text-xl font-bold">5.2 días</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasa de Aprobación</p>
              <p className="text-xl font-bold">94%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="todos" className="gap-1.5">
            Todos
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tabCounts.todos}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pendientes" className="gap-1.5">
            Pendientes
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white hover:bg-amber-500">
              {tabCounts.pendientes}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="revision" className="gap-1.5">
            En Revisión
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tabCounts.revision}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="notarial" className="gap-1.5">
            Validación Notarial
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tabCounts.notarial}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="certificados" className="gap-1.5">
            Certificados
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tabCounts.certificados}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rechazados" className="gap-1.5">
            Rechazados
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {tabCounts.rechazados}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ExpedienteTable data={filteredExpedientes} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
