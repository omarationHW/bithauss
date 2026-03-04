"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserPlus,
  Handshake,
  CheckCircle2,
  Search,
  MoreHorizontal,
  Eye,
  MessageSquare,
  Phone,
  Mail,
  TrendingUp,
} from "lucide-react";

type LeadEstado = "Nuevo" | "Contactado" | "En negociacion" | "Cerrado";

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
    nombre: "Ana Garcia Lopez",
    email: "ana.garcia@email.com",
    telefono: "+52 55 1234 5678",
    propiedad: "Depto. Polanco 3 Rec.",
    fecha: "4 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 2,
    nombre: "Roberto Hernandez Vega",
    email: "roberto.hv@email.com",
    telefono: "+52 55 2345 6789",
    propiedad: "Casa Coyoacan 250m2",
    fecha: "3 Mar 2026",
    estado: "Contactado",
  },
  {
    id: 3,
    nombre: "Maria Fernanda Ruiz",
    email: "mf.ruiz@email.com",
    telefono: "+52 55 3456 7890",
    propiedad: "Penthouse Santa Fe",
    fecha: "3 Mar 2026",
    estado: "En negociacion",
  },
  {
    id: 4,
    nombre: "Jorge Martinez Soto",
    email: "jorge.ms@email.com",
    telefono: "+52 55 4567 8901",
    propiedad: "Local Comercial Roma",
    fecha: "2 Mar 2026",
    estado: "Nuevo",
  },
  {
    id: 5,
    nombre: "Patricia Diaz Morales",
    email: "patricia.dm@email.com",
    telefono: "+52 55 5678 9012",
    propiedad: "Depto. Condesa 2 Rec.",
    fecha: "1 Mar 2026",
    estado: "Contactado",
  },
  {
    id: 6,
    nombre: "Fernando Castillo Reyes",
    email: "f.castillo@email.com",
    telefono: "+52 55 6789 0123",
    propiedad: "Casa Pedregal",
    fecha: "28 Feb 2026",
    estado: "En negociacion",
  },
  {
    id: 7,
    nombre: "Laura Sanchez Gutierrez",
    email: "laura.sg@email.com",
    telefono: "+52 55 7890 1234",
    propiedad: "Depto. Narvarte",
    fecha: "27 Feb 2026",
    estado: "Cerrado",
  },
  {
    id: 8,
    nombre: "Miguel Angel Torres",
    email: "ma.torres@email.com",
    telefono: "+52 55 8901 2345",
    propiedad: "Terreno Valle de Bravo",
    fecha: "26 Feb 2026",
    estado: "Nuevo",
  },
  {
    id: 9,
    nombre: "Claudia Ramirez Flores",
    email: "claudia.rf@email.com",
    telefono: "+52 55 9012 3456",
    propiedad: "Depto. Polanco 3 Rec.",
    fecha: "25 Feb 2026",
    estado: "Cerrado",
  },
  {
    id: 10,
    nombre: "Alejandro Vargas Pena",
    email: "a.vargas@email.com",
    telefono: "+52 55 0123 4567",
    propiedad: "Casa Coyoacan 250m2",
    fecha: "24 Feb 2026",
    estado: "Contactado",
  },
];

const kpis = [
  {
    label: "Total Leads",
    value: "156",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    label: "Nuevos",
    value: "18",
    icon: UserPlus,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    label: "En Negociacion",
    value: "12",
    icon: Handshake,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    label: "Cerrados este mes",
    value: "8",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
];

function getEstadoBadge(estado: LeadEstado) {
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
    case "Cerrado":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          {estado}
        </Badge>
      );
  }
}

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");

  const filteredLeads = leads.filter((lead) => {
    const matchesEstado =
      estadoFilter === "todos" || lead.estado === estadoFilter;
    const matchesSearch =
      !searchQuery ||
      lead.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.propiedad.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEstado && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mis Leads</h2>
        <p className="text-muted-foreground">
          Gestiona y da seguimiento a tus prospectos de clientes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={cn(
                  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg",
                  kpi.bgColor
                )}
              >
                <kpi.icon className={cn("h-6 w-6", kpi.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o propiedad..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Estado Dropdown */}
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="Nuevo">Nuevo</SelectItem>
                <SelectItem value="Contactado">Contactado</SelectItem>
                <SelectItem value="En negociacion">En negociacion</SelectItem>
                <SelectItem value="Cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>

            {/* Date filter placeholder */}
            <Input type="date" className="w-full sm:w-44" />
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No se encontraron leads con los filtros seleccionados
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left bg-muted/50">
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 font-medium text-muted-foreground">
                      Telefono
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 font-medium text-muted-foreground">
                      Propiedad Interesada
                    </th>
                    <th className="hidden xl:table-cell px-4 py-3 font-medium text-muted-foreground">
                      Fecha
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{lead.nombre}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {lead.email}
                          </p>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {lead.email}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                        {lead.telefono}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {lead.propiedad}
                      </td>
                      <td className="hidden xl:table-cell px-4 py-3 text-muted-foreground">
                        {lead.fecha}
                      </td>
                      <td className="px-4 py-3">
                        {getEstadoBadge(lead.estado)}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Acciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Enviar mensaje
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Phone className="mr-2 h-4 w-4" />
                              Llamar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Enviar email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <TrendingUp className="mr-2 h-4 w-4" />
                              Cambiar estado
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Mostrando {filteredLeads.length} de {leads.length} leads
      </div>
    </div>
  );
}
