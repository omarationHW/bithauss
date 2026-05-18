"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../../_context/user-context";
import Image from "next/image";
import {
  Users,
  Building2,
  Search,
  Loader2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  X,
  UserCheck,
  UserX,
} from "lucide-react";
import { ShieldBrc } from '@/components/ui/shield-brc'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type UserRole = "ADMIN" | "INMOBILIARIA" | "BROKER" | "VENDEDOR" | "COMPRADOR" | "NOTARIO" | "OPERADOR_BRC";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  INMOBILIARIA: "Inmobiliaria",
  BROKER: "Broker",
  VENDEDOR: "Vendedor",
  COMPRADOR: "Comprador",
  NOTARIO: "Notario",
  OPERADOR_BRC: "Operador BRC",
};

const roleBadgeStyles: Record<UserRole, string> = {
  ADMIN: "bg-purple-50 text-purple-700 border-purple-200",
  INMOBILIARIA: "bg-blue-50 text-blue-700 border-blue-200",
  BROKER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  VENDEDOR: "bg-amber-50 text-amber-700 border-amber-200",
  COMPRADOR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOTARIO: "bg-teal-50 text-teal-700 border-teal-200",
  OPERADOR_BRC: "bg-orange-50 text-orange-700 border-orange-200",
};

const allRoles: UserRole[] = ["ADMIN", "INMOBILIARIA", "BROKER", "VENDEDOR", "COMPRADOR", "NOTARIO", "OPERADOR_BRC"];

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function UsuariosPage() {
  const { user } = useUser();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch all profiles
  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;

    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, role, is_active, phone, avatar_url, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProfiles(data as Profile[]);
      }
      setLoading(false);
    }

    fetchProfiles();
  }, [user, supabase]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(
      (p) =>
        (p.first_name?.toLowerCase() ?? "").includes(q) ||
        (p.last_name?.toLowerCase() ?? "").includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: profiles.length,
      brokers: profiles.filter((p) => p.role === "BROKER" || p.role === "INMOBILIARIA").length,
      compradores: profiles.filter((p) => p.role === "COMPRADOR").length,
      notarios: profiles.filter((p) => p.role === "NOTARIO").length,
    };
  }, [profiles]);

  // Change role via API (server-side @Roles('ADMIN') enforcement)
  async function handleChangeRole(profileId: string, newRole: UserRole) {
    setUpdatingId(profileId);
    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/admin/users/${profileId}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newRole } : p))
      );
    }
    setUpdatingId(null);
  }

  // Toggle active via API
  async function handleToggleActive(profileId: string, currentActive: boolean) {
    setUpdatingId(profileId);
    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/admin/users/${profileId}/active`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (res.ok) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, is_active: !currentActive } : p))
      );
    }
    setUpdatingId(null);
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">No tienes permisos para acceder a esta pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Gestion de Usuarios
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Administra todos los usuarios de la plataforma BitHauss.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Usuarios", value: stats.total, icon: Users, change: "registrados" },
          { label: "Brokers", value: stats.brokers, icon: Building2, change: "activos" },
          { label: "Compradores", value: stats.compradores, icon: UserCheck, change: "registrados" },
          { label: "Notarios", value: stats.notarios, icon: ShieldBrc, change: "registrados" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div
              className="absolute inset-x-0 top-0 h-1 opacity-80"
              style={{
                background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            />
            <div className="flex items-center justify-between">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm"
                style={{
                  background: "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                }}
              >
                <kpi.icon className="h-5 w-5" style={{ color: "hsl(221 83% 53%)" }} />
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                {kpi.change}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-gray-900">{loading ? "..." : kpi.value}</p>
              <p className="mt-1 text-sm font-medium text-gray-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Usuario
                </th>
                <th className="hidden px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider sm:table-cell">
                  Email
                </th>
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Estado
                </th>
                <th className="hidden px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider md:table-cell">
                  Registro
                </th>
                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" />
                    <p className="mt-2 text-sm text-gray-400">Cargando usuarios...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Users className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-400">
                      {searchQuery ? "No se encontraron usuarios con esa busqueda." : "No hay usuarios registrados."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((profile) => {
                  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Sin nombre";
                  const initials = profile.first_name && profile.last_name
                    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
                    : fullName.slice(0, 2).toUpperCase();
                  const isExpanded = expandedId === profile.id;

                  return (
                    <tr key={profile.id} className="border-t border-gray-100 transition-colors duration-200 hover:bg-gray-50/80">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {profile.avatar_url ? (
                            <Image
                              src={profile.avatar_url}
                              alt={fullName}
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{
                                background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                              }}
                            >
                              {initials}
                            </div>
                          )}
                          <span className="font-semibold text-gray-900">{fullName}</span>
                        </div>
                      </td>
                      <td className="hidden px-6 py-4 text-gray-500 sm:table-cell">
                        {profile.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${roleBadgeStyles[profile.role]}`}
                        >
                          {roleLabels[profile.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {profile.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="hidden px-6 py-4 text-gray-500 md:table-cell">
                        {new Date(profile.created_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:bg-gray-100"
                          style={{ color: "hsl(221 83% 53%)" }}
                        >
                          {isExpanded ? "Cerrar" : "Ver mas"}
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded User Detail Panel */}
        {expandedId && (
          <div className="border-t border-gray-100 bg-gray-50/50 p-6">
            {(() => {
              const profile = profiles.find((p) => p.id === expandedId);
              if (!profile) return null;
              const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Sin nombre";
              const isUpdating = updatingId === profile.id;

              return (
                <div className="mx-auto max-w-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <h4
                      className="text-lg font-bold text-gray-900"
                      style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                    >
                      Detalles de {fullName}
                    </h4>
                    <button
                      onClick={() => setExpandedId(null)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profile.email}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Telefono</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">{profile.phone ?? "No registrado"}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha de registro</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {new Date(profile.created_at).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ID</p>
                      <p className="mt-1 text-xs font-mono text-gray-500 break-all">{profile.id}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Role selector */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700">Cambiar rol:</label>
                      <select
                        value={profile.role}
                        onChange={(e) => handleChangeRole(profile.id, e.target.value as UserRole)}
                        disabled={isUpdating}
                        className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition-all duration-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                      >
                        {allRoles.map((r) => (
                          <option key={r} value={r}>
                            {roleLabels[r]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(profile.id, profile.is_active !== false)}
                      disabled={isUpdating}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 disabled:opacity-50 ${
                        profile.is_active !== false
                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : profile.is_active !== false ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      {profile.is_active !== false ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-sm text-gray-400">
          Mostrando {filtered.length} de {profiles.length} usuarios
        </p>
      )}
    </div>
  );
}
