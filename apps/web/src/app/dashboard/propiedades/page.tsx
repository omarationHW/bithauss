"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  Pause,
  Trash2,
  Eye,
  Users,
  Building2,
  Play,
  ShieldCheck,
  MapPin,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../_context/user-context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DbStatus = "PUBLICADO" | "BORRADOR" | "PAUSADO" | "ELIMINADO";
type BrcStatus = "CERTIFICADO" | "EN_REVISION" | "NO_SOLICITADO" | null;
type TabValue = "todas" | "PUBLICADO" | "BORRADOR" | "PAUSADO";

type OperationType = "VENTA" | "RENTA" | "TRASPASO";
type BrcFilter = "todas" | "CERTIFICADO" | "EN_REVISION" | "NO_SOLICITADO";
type OpFilter = "todas" | OperationType;

interface Property {
  id: string;
  title: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  price: number | null;
  currency: string | null;
  status: DbStatus;
  brc_status: BrcStatus;
  operation: OperationType;
  lead_count: number;
  view_count: number;
  featured_image_url: string | null;
}

const tabs: { label: string; value: TabValue }[] = [
  { label: "Todas", value: "todas" },
  { label: "Publicadas", value: "PUBLICADO" },
  { label: "Borradores", value: "BORRADOR" },
  { label: "Pausadas", value: "PAUSADO" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "Sin precio";
  const cur = currency ?? "MXN";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + ` ${cur}`;
}

function formatLocation(
  address: string | null,
  city: string | null,
  state: string | null,
): string {
  return [address, city, state].filter(Boolean).join(", ") || "Sin ubicación";
}

function estadoBadge(status: DbStatus) {
  const map: Record<DbStatus, { classes: string; label: string }> = {
    PUBLICADO: {
      classes: "bg-emerald-50 text-emerald-600 border-emerald-200",
      label: "Publicado",
    },
    BORRADOR: {
      classes: "bg-gray-100 text-gray-600 border-gray-200",
      label: "Borrador",
    },
    PAUSADO: {
      classes: "bg-amber-50 text-amber-600 border-amber-200",
      label: "Pausado",
    },
    ELIMINADO: {
      classes: "bg-red-50 text-red-600 border-red-200",
      label: "Eliminado",
    },
  };
  const info = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${info.classes}`}
    >
      {info.label}
    </span>
  );
}

function brcBadge(brcStatus: BrcStatus) {
  if (!brcStatus || brcStatus === "NO_SOLICITADO") return null;

  const map: Record<string, { classes: string; label: string }> = {
    CERTIFICADO: {
      classes: "bg-emerald-50 text-emerald-600 border-emerald-200",
      label: "BRC Certificado",
    },
    EN_REVISION: {
      classes: "bg-blue-50 text-blue-600 border-blue-200",
      label: "BRC En Revisión",
    },
  };
  const info = map[brcStatus];
  if (!info) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${info.classes}`}
    >
      <ShieldCheck className="h-3 w-3" />
      {info.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PropiedadesPage() {
  const { user } = useUser();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("todas");
  const [brcFilter, setBrcFilter] = useState<BrcFilter>("todas");
  const [opFilter, setOpFilter] = useState<OpFilter>("todas");
  const [search, setSearch] = useState("");

  /* ---- Fetch properties ------------------------------------------ */
  const fetchProperties = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("properties")
      .select(
        "id, title, address_line, city, state, price, currency, status, brc_status, operation, lead_count, view_count, featured_image_url",
      )
      .eq("owner_id", user.id)
      .neq("status", "ELIMINADO")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProperties(data as Property[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  /* ---- Toggle pause / publish ------------------------------------ */
  async function handleTogglePause(prop: Property) {
    const newStatus: DbStatus =
      prop.status === "PAUSADO" ? "PUBLICADO" : "PAUSADO";
    const supabase = createClient();
    const { error } = await supabase
      .from("properties")
      .update({ status: newStatus })
      .eq("id", prop.id);

    if (!error) {
      setProperties((prev) =>
        prev.map((p) => (p.id === prop.id ? { ...p, status: newStatus } : p)),
      );
    }
  }

  /* ---- Soft-delete ----------------------------------------------- */
  async function handleDelete(prop: Property) {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar "${prop.title}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("properties")
      .update({ status: "ELIMINADO" })
      .eq("id", prop.id);

    if (!error) {
      setProperties((prev) => prev.filter((p) => p.id !== prop.id));
    }
  }

  /* ---- Filter ---------------------------------------------------- */
  const filtered = properties.filter((p) => {
    if (activeTab !== "todas" && p.status !== activeTab) return false;
    if (brcFilter !== "todas" && p.brc_status !== brcFilter) return false;
    if (opFilter !== "todas" && p.operation !== opFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const location = formatLocation(p.address_line, p.city, p.state);
      return (
        (p.title ?? "").toLowerCase().includes(q) ||
        location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ---- Loading state --------------------------------------------- */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-3 text-sm text-gray-500">Cargando propiedades...</p>
      </div>
    );
  }

  /* ---- Empty state (no properties at all) ------------------------ */
  if (properties.length === 0) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Mis Propiedades
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Administra y gestiona todas tus propiedades publicadas.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-20 shadow-sm">
          <Building2 className="mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-6 text-base font-medium text-gray-500">
            Aún no has publicado propiedades
          </p>
          <Link
            href="/dashboard/propiedades/nueva"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }}
          >
            <Plus className="h-4 w-4" />
            Publicar mi primera propiedad
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Header                                                       */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Mis Propiedades
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Administra y gestiona todas tus propiedades publicadas.
          </p>
        </div>
        <Link
          href="/dashboard/propiedades/nueva"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          <Plus className="h-4 w-4" />
          Publicar Propiedad
        </Link>
      </div>

      {/* ============================================================ */}
      {/*  Filter Tabs + Search                                         */}
      {/* ============================================================ */}
      <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                  isActive
                    ? "text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      }
                    : undefined
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar propiedades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 shadow-sm outline-none transition-all duration-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Extra filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs font-medium text-gray-400 self-center mr-1">Operación:</span>
        {([["todas", "Todas"], ["VENTA", "Venta"], ["RENTA", "Renta"], ["TRASPASO", "Traspaso"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setOpFilter(val as OpFilter)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              opFilter === val
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs font-medium text-gray-400 self-center ml-3 mr-1">BRC:</span>
        {([["todas", "Todas"], ["CERTIFICADO", "Certificado"], ["EN_REVISION", "En revisión"], ["NO_SOLICITADO", "Sin BRC"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setBrcFilter(val as BrcFilter)}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              brcFilter === val
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* ============================================================ */}
      {/*  Property Cards Grid                                          */}
      {/* ============================================================ */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 shadow-sm">
          <Building2 className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            No se encontraron propiedades
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((prop) => (
            <div
              key={prop.id}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Image */}
              <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                {prop.featured_image_url ? (
                  <Image
                    src={prop.featured_image_url}
                    alt={prop.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-105"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53% / 0.15), hsl(160 84% 39% / 0.15))",
                    }}
                  >
                    <Building2 className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                {/* Badges overlay */}
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {estadoBadge(prop.status)}
                  {brcBadge(prop.brc_status)}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <Link href={`/propiedades/${prop.id}`} target="_blank">
                  <h3
                    className="text-base font-bold text-gray-900 line-clamp-1 hover:text-blue-600 transition-colors cursor-pointer"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    {prop.title || "Sin título"}
                  </h3>
                </Link>
                <div className="mt-1.5 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="line-clamp-1">
                    {formatLocation(prop.address_line, prop.city, prop.state)}
                  </span>
                </div>

                <p
                  className="mt-3 text-lg font-bold"
                  style={{ color: "hsl(221 83% 53%)" }}
                >
                  {formatPrice(prop.price, prop.currency)}
                </p>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {prop.view_count ?? 0} visitas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {prop.lead_count ?? 0} leads
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/propiedades/${prop.id}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver
                  </Link>
                  <Link
                    href={`/dashboard/propiedades/${prop.id}/editar`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Link>
                  <button
                    onClick={() => handleTogglePause(prop)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
                  >
                    {prop.status === "PAUSADO" ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Publicar
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Pausar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(prop)}
                    className="flex items-center justify-center rounded-xl border border-red-100 bg-white p-2 text-red-400 transition-all duration-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
