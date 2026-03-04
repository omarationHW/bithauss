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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Pause,
  Trash2,
  Eye,
  Users,
  Building2,
  Play,
} from "lucide-react";

interface Property {
  id: number;
  titulo: string;
  ubicacion: string;
  precio: string;
  estado: "Activa" | "Borrador" | "Pausada";
  leads: number;
  visitas: number;
  tipo: string;
}

const properties: Property[] = [
  {
    id: 1,
    titulo: "Departamento en Polanco, 3 Recamaras",
    ubicacion: "Polanco, Miguel Hidalgo, CDMX",
    precio: "$4,850,000 MXN",
    estado: "Activa",
    leads: 6,
    visitas: 89,
    tipo: "Departamento",
  },
  {
    id: 2,
    titulo: "Casa en Coyoacan, 250m2",
    ubicacion: "Coyoacan, CDMX",
    precio: "$7,200,000 MXN",
    estado: "Activa",
    leads: 9,
    visitas: 124,
    tipo: "Casa",
  },
  {
    id: 3,
    titulo: "Penthouse en Santa Fe con Vista Panoramica",
    ubicacion: "Santa Fe, Alvaro Obregon, CDMX",
    precio: "$12,500,000 MXN",
    estado: "Pausada",
    leads: 3,
    visitas: 45,
    tipo: "Penthouse",
  },
  {
    id: 4,
    titulo: "Local Comercial en Roma Norte",
    ubicacion: "Roma Norte, Cuauhtemoc, CDMX",
    precio: "$3,200,000 MXN",
    estado: "Activa",
    leads: 4,
    visitas: 67,
    tipo: "Comercial",
  },
  {
    id: 5,
    titulo: "Departamento en Condesa, 2 Recamaras",
    ubicacion: "Condesa, Cuauhtemoc, CDMX",
    precio: "$3,900,000 MXN",
    estado: "Activa",
    leads: 7,
    visitas: 98,
    tipo: "Departamento",
  },
  {
    id: 6,
    titulo: "Casa en Pedregal de San Angel",
    ubicacion: "Pedregal, Coyoacan, CDMX",
    precio: "$15,800,000 MXN",
    estado: "Borrador",
    leads: 0,
    visitas: 0,
    tipo: "Casa",
  },
  {
    id: 7,
    titulo: "Departamento en Narvarte, Remodelado",
    ubicacion: "Narvarte, Benito Juarez, CDMX",
    precio: "$2,750,000 MXN",
    estado: "Activa",
    leads: 11,
    visitas: 156,
    tipo: "Departamento",
  },
  {
    id: 8,
    titulo: "Terreno en Valle de Bravo",
    ubicacion: "Valle de Bravo, Estado de Mexico",
    precio: "$1,850,000 MXN",
    estado: "Borrador",
    leads: 0,
    visitas: 0,
    tipo: "Terreno",
  },
];

function getEstadoBadge(estado: Property["estado"]) {
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
  }
}

function PropertyRow({ prop }: { prop: Property }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/50 transition-colors">
      {/* Image + Title */}
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{prop.titulo}</p>
            <p className="text-xs text-muted-foreground">{prop.tipo}</p>
          </div>
        </div>
      </td>
      {/* Location */}
      <td className="hidden md:table-cell py-3 pr-4">
        <span className="text-sm text-muted-foreground">{prop.ubicacion}</span>
      </td>
      {/* Price */}
      <td className="py-3 pr-4">
        <span className="text-sm font-semibold">{prop.precio}</span>
      </td>
      {/* Status */}
      <td className="py-3 pr-4">{getEstadoBadge(prop.estado)}</td>
      {/* Leads */}
      <td className="hidden lg:table-cell py-3 pr-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {prop.leads}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {prop.visitas}
          </span>
        </div>
      </td>
      {/* Actions */}
      <td className="py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem>
              {prop.estado === "Pausada" ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Reactivar
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

export default function PropiedadesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filterByEstado = (estado?: Property["estado"]) => {
    let filtered = properties;
    if (estado) {
      filtered = filtered.filter((p) => p.estado === estado);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.titulo.toLowerCase().includes(q) ||
          p.ubicacion.toLowerCase().includes(q) ||
          p.tipo.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const counts = {
    todas: properties.length,
    activas: properties.filter((p) => p.estado === "Activa").length,
    borradores: properties.filter((p) => p.estado === "Borrador").length,
    pausadas: properties.filter((p) => p.estado === "Pausada").length,
  };

  const renderTable = (items: Property[]) => (
    <div className="overflow-x-auto">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            No se encontraron propiedades
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 pr-4 font-medium text-muted-foreground">
                Propiedad
              </th>
              <th className="hidden md:table-cell pb-3 pr-4 font-medium text-muted-foreground">
                Ubicacion
              </th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground">
                Precio
              </th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground">
                Estado
              </th>
              <th className="hidden lg:table-cell pb-3 pr-4 font-medium text-muted-foreground">
                Metricas
              </th>
              <th className="pb-3 font-medium text-muted-foreground">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((prop) => (
              <PropertyRow key={prop.id} prop={prop} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Mis Propiedades
          </h2>
          <p className="text-muted-foreground">
            Administra y gestiona todas tus propiedades publicadas.
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nueva Propiedad
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar propiedades..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs + Table */}
      <Card>
        <Tabs defaultValue="todas">
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="todas">
                Todas ({counts.todas})
              </TabsTrigger>
              <TabsTrigger value="activas">
                Activas ({counts.activas})
              </TabsTrigger>
              <TabsTrigger value="borradores">
                Borradores ({counts.borradores})
              </TabsTrigger>
              <TabsTrigger value="pausadas">
                Pausadas ({counts.pausadas})
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-6">
            <TabsContent value="todas" className="mt-0">
              {renderTable(filterByEstado())}
            </TabsContent>
            <TabsContent value="activas" className="mt-0">
              {renderTable(filterByEstado("Activa"))}
            </TabsContent>
            <TabsContent value="borradores" className="mt-0">
              {renderTable(filterByEstado("Borrador"))}
            </TabsContent>
            <TabsContent value="pausadas" className="mt-0">
              {renderTable(filterByEstado("Pausada"))}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
