"use client";

import { useState } from "react";
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Mock Data                                                  */
/* ------------------------------------------------------------------ */

type Estado = "Publicado" | "Borrador" | "Pausado";

interface Property {
  id: number;
  titulo: string;
  ubicacion: string;
  precio: string;
  estado: Estado;
  brc: "Verificado" | "Pendiente" | "No solicitado";
  leads: number;
  visitas: number;
  imagen: string;
}

const CDN = "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images";

const properties: Property[] = [
  {
    id: 1,
    titulo: "Departamento en Polanco, 3 Recámaras",
    ubicacion: "Polanco, Miguel Hidalgo, CDMX",
    precio: "$4,850,000 MXN",
    estado: "Publicado",
    brc: "Verificado",
    leads: 6,
    visitas: 89,
    imagen: `${CDN}/Casa1.webp`,
  },
  {
    id: 2,
    titulo: "Casa en Coyoacán, 250m²",
    ubicacion: "Coyoacán, CDMX",
    precio: "$7,200,000 MXN",
    estado: "Publicado",
    brc: "Verificado",
    leads: 9,
    visitas: 124,
    imagen: `${CDN}/casa2.webp`,
  },
  {
    id: 3,
    titulo: "Penthouse en Santa Fe con Vista Panorámica",
    ubicacion: "Santa Fe, Álvaro Obregón, CDMX",
    precio: "$12,500,000 MXN",
    estado: "Pausado",
    brc: "Pendiente",
    leads: 3,
    visitas: 45,
    imagen: `${CDN}/casa3.webp`,
  },
  {
    id: 4,
    titulo: "Local Comercial en Roma Norte",
    ubicacion: "Roma Norte, Cuauhtémoc, CDMX",
    precio: "$3,200,000 MXN",
    estado: "Publicado",
    brc: "No solicitado",
    leads: 4,
    visitas: 67,
    imagen: `${CDN}/casa4.webp`,
  },
  {
    id: 5,
    titulo: "Departamento en Condesa, 2 Recámaras",
    ubicacion: "Condesa, Cuauhtémoc, CDMX",
    precio: "$3,900,000 MXN",
    estado: "Borrador",
    brc: "No solicitado",
    leads: 0,
    visitas: 0,
    imagen: `${CDN}/casa5.webp`,
  },
  {
    id: 6,
    titulo: "Casa en Pedregal de San Ángel",
    ubicacion: "Pedregal, Coyoacán, CDMX",
    precio: "$15,800,000 MXN",
    estado: "Publicado",
    brc: "Verificado",
    leads: 12,
    visitas: 203,
    imagen: `${CDN}/casa6.webp`,
  },
];

const tabs: { label: string; value: "todas" | Estado }[] = [
  { label: "Todas", value: "todas" },
  { label: "Publicadas", value: "Publicado" },
  { label: "Borradores", value: "Borrador" },
  { label: "Pausadas", value: "Pausado" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function estadoBadge(estado: Estado) {
  const map: Record<Estado, string> = {
    Publicado: "bg-emerald-50 text-emerald-600 border-emerald-200",
    Borrador: "bg-gray-100 text-gray-600 border-gray-200",
    Pausado: "bg-amber-50 text-amber-600 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${map[estado]}`}
    >
      {estado}
    </span>
  );
}

function brcBadge(brc: Property["brc"]) {
  const map: Record<string, string> = {
    Verificado: "bg-blue-50 text-blue-600 border-blue-200",
    Pendiente: "bg-orange-50 text-orange-600 border-orange-200",
    "No solicitado": "bg-gray-50 text-gray-400 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${map[brc]}`}
    >
      <ShieldCheck className="h-3 w-3" />
      {brc === "No solicitado" ? "Sin BRC" : `BRC ${brc}`}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PropiedadesPage() {
  const [activeTab, setActiveTab] = useState<"todas" | Estado>("todas");
  const [search, setSearch] = useState("");

  const filtered = properties.filter((p) => {
    if (activeTab !== "todas" && p.estado !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.titulo.toLowerCase().includes(q) ||
        p.ubicacion.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
        <button
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          <Plus className="h-4 w-4" />
          Publicar Propiedad
        </button>
      </div>

      {/* ============================================================ */}
      {/*  Filter Tabs + Search                                         */}
      {/* ============================================================ */}
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
                <img
                  src={prop.imagen}
                  alt={prop.titulo}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Badges overlay */}
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {estadoBadge(prop.estado)}
                  {brcBadge(prop.brc)}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3
                  className="text-base font-bold text-gray-900 line-clamp-1"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  {prop.titulo}
                </h3>
                <div className="mt-1.5 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="line-clamp-1">{prop.ubicacion}</span>
                </div>

                <p
                  className="mt-3 text-lg font-bold"
                  style={{ color: "hsl(221 83% 53%)" }}
                >
                  {prop.precio}
                </p>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {prop.visitas} visitas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {prop.leads} leads
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm">
                    {prop.estado === "Pausado" ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Reactivar
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Pausar
                      </>
                    )}
                  </button>
                  <button className="flex items-center justify-center rounded-xl border border-red-100 bg-white p-2 text-red-400 transition-all duration-300 hover:bg-red-50 hover:text-red-600">
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
