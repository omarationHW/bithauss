"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type UserRole = "Admin" | "Broker" | "Inmobiliaria" | "Vendedor" | "Comprador" | "Notario" | "Operador BRC";
type UserStatus = "Activo" | "Inactivo" | "Pendiente";

interface UserData {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: UserRole;
  membership: string;
  registeredAt: string;
  status: UserStatus;
}

const roleColors: Record<UserRole, string> = {
  Admin: "bg-red-500/10 text-red-500 border-red-500/20",
  Broker: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Inmobiliaria: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  Vendedor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Comprador: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  Notario: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "Operador BRC": "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

const statusColors: Record<UserStatus, string> = {
  Activo: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Inactivo: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  Pendiente: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const users: UserData[] = [
  {
    id: "1",
    name: "Carlos Mendoza",
    initials: "CM",
    email: "carlos.mendoza@email.com",
    role: "Broker",
    membership: "Profesional",
    registeredAt: "15 Ene 2025",
    status: "Activo",
  },
  {
    id: "2",
    name: "María González Torres",
    initials: "MG",
    email: "maria.gonzalez@inmobiliaria.mx",
    role: "Inmobiliaria",
    membership: "Enterprise",
    registeredAt: "22 Feb 2025",
    status: "Activo",
  },
  {
    id: "3",
    name: "Roberto Hernández",
    initials: "RH",
    email: "roberto.hdez@email.com",
    role: "Vendedor",
    membership: "Básico",
    registeredAt: "03 Mar 2025",
    status: "Activo",
  },
  {
    id: "4",
    name: "Ana Lucía Ramírez",
    initials: "AR",
    email: "ana.ramirez@notaria.mx",
    role: "Notario",
    membership: "-",
    registeredAt: "10 Ene 2025",
    status: "Activo",
  },
  {
    id: "5",
    name: "Fernando López Ruiz",
    initials: "FL",
    email: "fernando.lopez@email.com",
    role: "Comprador",
    membership: "-",
    registeredAt: "18 Mar 2025",
    status: "Pendiente",
  },
  {
    id: "6",
    name: "Patricia Vega Soto",
    initials: "PV",
    email: "patricia.vega@bithauss.com",
    role: "Admin",
    membership: "-",
    registeredAt: "01 Ene 2024",
    status: "Activo",
  },
  {
    id: "7",
    name: "Jorge Martínez Díaz",
    initials: "JM",
    email: "jorge.martinez@broker.mx",
    role: "Broker",
    membership: "Profesional",
    registeredAt: "28 Feb 2025",
    status: "Activo",
  },
  {
    id: "8",
    name: "Gabriela Flores",
    initials: "GF",
    email: "gabriela.flores@bithauss.com",
    role: "Operador BRC",
    membership: "-",
    registeredAt: "15 Feb 2025",
    status: "Activo",
  },
  {
    id: "9",
    name: "Luis Alberto Castillo",
    initials: "LC",
    email: "luis.castillo@email.com",
    role: "Broker",
    membership: "Básico",
    registeredAt: "05 Mar 2025",
    status: "Inactivo",
  },
  {
    id: "10",
    name: "Sofía Morales Ponce",
    initials: "SM",
    email: "sofia.morales@inmobiliaria.mx",
    role: "Inmobiliaria",
    membership: "Profesional",
    registeredAt: "12 Mar 2025",
    status: "Activo",
  },
  {
    id: "11",
    name: "Diego Navarro",
    initials: "DN",
    email: "diego.navarro@email.com",
    role: "Vendedor",
    membership: "Básico",
    registeredAt: "20 Mar 2025",
    status: "Pendiente",
  },
  {
    id: "12",
    name: "Valentina Cruz Ortega",
    initials: "VC",
    email: "valentina.cruz@notaria.mx",
    role: "Notario",
    membership: "-",
    registeredAt: "08 Feb 2025",
    status: "Activo",
  },
];

export default function UsuariosPage() {
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users.filter((user) => {
    const matchesRole =
      roleFilter === "todos" || user.role.toLowerCase() === roleFilter.toLowerCase();
    const matchesStatus =
      statusFilter === "todos" || user.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Gestión de Usuarios
        </h2>
        <p className="text-muted-foreground">
          Administra los usuarios registrados en la plataforma
        </p>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
                <SelectItem value="vendedor">Vendedor</SelectItem>
                <SelectItem value="comprador">Comprador</SelectItem>
                <SelectItem value="notario">Notario</SelectItem>
                <SelectItem value="operador brc">Operador BRC</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    Membresía
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                    Fecha Registro
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
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {user.email}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("text-[11px]", roleColors[user.role])}
                      >
                        {user.role}
                      </Badge>
                    </td>

                    {/* Membership */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm">{user.membership}</span>
                    </td>

                    {/* Registration Date */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {user.registeredAt}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("text-[11px]", statusColors[user.status])}
                      >
                        {user.status}
                      </Badge>
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Ban className="mr-2 h-4 w-4" />
                            Suspender
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredUsers.length} de {users.length} usuarios
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                1
              </Button>
              <Button variant="outline" size="sm">
                2
              </Button>
              <Button variant="outline" size="sm">
                3
              </Button>
              <Button variant="outline" size="sm">
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
