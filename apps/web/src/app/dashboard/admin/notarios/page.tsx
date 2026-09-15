"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../../_context/user-context";
import Image from "next/image";
import { ShieldBrc } from '@/components/ui/shield-brc'
import { SpotlightCard } from "@/components/ui/spotlight-card";
import {
  Search,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  MapPin,
  Phone,
  Mail,
  Hash,
  Users,
  ExternalLink,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NotaryProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  notary_profiles: {
    notary_number: string | null;
    notary_state: string | null;
    is_verified: boolean;
    license_url: string | null;
  } | null;
}

type Tab = "pendientes" | "verificados";

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function NotariosVerificacionPage() {
  const { user } = useUser();
  const [notaries, setNotaries] = useState<NotaryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("pendientes");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  /* Fetch notaries ------------------------------------------------- */
  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;

    async function fetchNotaries() {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, email, phone, avatar_url, created_at, notary_profiles(notary_number, notary_state, is_verified, license_url)"
        )
        .eq("role", "NOTARIO")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setNotaries(data as unknown as NotaryProfile[]);
      }
      setLoading(false);
    }

    fetchNotaries();
  }, [user, supabase]);

  /* Filter by tab + search ---------------------------------------- */
  const filtered = useMemo(() => {
    let list = notaries;

    // Tab filter
    if (activeTab === "pendientes") {
      list = list.filter((n) => !n.notary_profiles?.is_verified);
    } else {
      list = list.filter((n) => n.notary_profiles?.is_verified === true);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          (n.first_name?.toLowerCase() ?? "").includes(q) ||
          (n.last_name?.toLowerCase() ?? "").includes(q) ||
          n.email.toLowerCase().includes(q)
      );
    }

    return list;
  }, [notaries, activeTab, searchQuery]);

  /* Stats --------------------------------------------------------- */
  const stats = useMemo(() => {
    const total = notaries.length;
    const verificados = notaries.filter(
      (n) => n.notary_profiles?.is_verified === true
    ).length;
    const pendientes = total - verificados;
    return { total, verificados, pendientes };
  }, [notaries]);

  /* Verify notary via API (server-side @Roles('ADMIN') enforcement) */
  async function handleVerify(profileId: string) {
    setUpdatingId(profileId);
    const { data: { session } } = await supabase.auth.getSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${apiBase}/api/v1/admin/notaries/${profileId}/verify`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ verified: true }),
    });

    if (res.ok) {
      setNotaries((prev) =>
        prev.map((n) =>
          n.id === profileId
            ? {
                ...n,
                notary_profiles: n.notary_profiles
                  ? { ...n.notary_profiles, is_verified: true }
                  : n.notary_profiles,
              }
            : n
        )
      );
    }
    setUpdatingId(null);
  }

  /* Reject notary (delete notary_profile row) ---------------------- */
  async function handleReject(profileId: string) {
    if (!confirm("¿Estas seguro de rechazar a este notario? Esta accion eliminara su perfil de notario.")) return;

    setUpdatingId(profileId);
    const { error } = await supabase
      .from("notary_profiles")
      .delete()
      .eq("profile_id", profileId);

    if (!error) {
      setNotaries((prev) => prev.filter((n) => n.id !== profileId));
    }
    setUpdatingId(null);
  }

  /* Helpers ------------------------------------------------------- */
  function getInitials(n: NotaryProfile) {
    if (n.first_name && n.last_name) {
      return `${n.first_name[0]}${n.last_name[0]}`.toUpperCase();
    }
    const full = `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() || "NN";
    return full.slice(0, 2).toUpperCase();
  }

  function getFullName(n: NotaryProfile) {
    return `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() || "Sin nombre";
  }

  /* Guard --------------------------------------------------------- */
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
          Verificacion de Notarios
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Revisa y verifica las solicitudes de notarios registrados en BitHauss.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          {
            label: "Total Notarios",
            value: stats.total,
            icon: Users,
            accent: "hsl(221 83% 53%)",
          },
          {
            label: "Pendientes de Verificacion",
            value: stats.pendientes,
            icon: Clock,
            accent: "hsl(38 92% 50%)",
          },
          {
            label: "Verificados",
            value: stats.verificados,
            icon: CheckCircle2,
            accent: "hsl(160 84% 39%)",
          },
        ].map((kpi) => (
          <SpotlightCard
            key={kpi.label}
            padding="md"
            spotlightColor={`${kpi.accent.slice(0, -1)} / 0.12)`}
          >
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                <p
                  className="mt-2 text-3xl font-bold tracking-tight text-gray-900"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  {loading ? "..." : kpi.value}
                </p>
              </div>
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${kpi.accent.slice(0, -1)} / 0.1)` }}
              >
                <kpi.icon className="h-5 w-5" style={{ color: kpi.accent }} />
              </div>
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              { key: "pendientes" as Tab, label: "Pendientes", count: stats.pendientes },
              { key: "verificados" as Tab, label: "Verificados", count: stats.verificados },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  activeTab === tab.key
                    ? tab.key === "pendientes"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {loading ? "..." : tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md sm:w-80">
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
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">Cargando notarios...</p>
        </div>
      ) : filtered.length === 0 ? (
        <SpotlightCard padding="none" className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <ShieldBrc className="h-7 w-7 text-blue-500" />
          </div>
          <p className="relative mt-4 text-sm font-medium text-gray-500">
            {searchQuery
              ? "No se encontraron notarios con esa busqueda."
              : activeTab === "pendientes"
              ? "No hay notarios pendientes de verificacion."
              : "No hay notarios verificados aun."}
          </p>
        </SpotlightCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((notary) => {
            const fullName = getFullName(notary);
            const initials = getInitials(notary);
            const np = notary.notary_profiles;
            const isUpdating = updatingId === notary.id;

            return (
              <SpotlightCard
                key={notary.id}
                padding="none"
                interactive
                spotlightColor={
                  np?.is_verified ? "hsl(160 84% 39% / 0.12)" : "hsl(38 92% 50% / 0.14)"
                }
              >
                <div className="relative p-6">
                  {/* Header: avatar + name + badge */}
                  <div className="flex items-start gap-4">
                    {notary.avatar_url ? (
                      <Image
                        src={notary.avatar_url}
                        alt={fullName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-base font-bold text-gray-900"
                        style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                      >
                        {fullName}
                      </h3>
                      {/* Status badge */}
                      {np?.is_verified ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Verificado
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          <Clock className="h-3 w-3" />
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-5 space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{notary.email}</span>
                    </div>
                    {notary.phone && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>{notary.phone}</span>
                      </div>
                    )}
                    {np?.notary_number && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Hash className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>Notaria No. {np.notary_number}</span>
                      </div>
                    )}
                    {np?.notary_state && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                        <span>{np.notary_state}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <span>
                        Registro:{" "}
                        {new Date(notary.created_at).toLocaleDateString(
                          "es-MX",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  </div>

                  {/* License link */}
                  {np?.license_url && (
                    <a
                      href={np.license_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver licencia
                    </a>
                  )}

                  {/* Actions for pending */}
                  {!np?.is_verified && (
                    <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-5">
                      <button
                        type="button"
                        onClick={() => handleVerify(notary.id)}
                        disabled={isUpdating}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-[box-shadow,opacity] duration-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 disabled:opacity-50"
                        style={{
                          background:
                            "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                        }}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Verificar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(notary.id)}
                        disabled={isUpdating}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors duration-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}

      {/* Count */}
      {!loading && (
        <p className="text-sm text-gray-400">
          Mostrando {filtered.length} de {notaries.length} notarios
        </p>
      )}
    </div>
  );
}
