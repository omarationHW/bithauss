"use client";

/**
 * Change-history timeline for a property or a lead.
 *
 * Reads `audit_logs`, which is written exclusively by the Postgres
 * trigger installed in migration 010 (`public.audit_row_change`). The
 * trigger stores only the columns that actually changed, so every entry
 * here can be rendered as "campo: valor anterior → valor nuevo".
 *
 * RLS scopes the read to rows whose `entity_owner_id` is the current
 * user (or to everything, for ADMIN), so no extra filtering is needed.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type HistorialEntity = "properties" | "leads";

type AuditAction = "CREATED" | "UPDATED" | "STATUS_CHANGED" | "DELETED";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

interface AuditEntry {
  id: string;
  action: AuditAction;
  actorName: string | null;
  actorRole: string | null;
  oldData: Record<string, JsonValue> | null;
  newData: Record<string, JsonValue> | null;
  createdAt: string;
}

interface HistorialTimelineProps {
  entityType: HistorialEntity;
  entityId: string;
  /**
   * Shown as a synthetic "alta" entry for rows created before the audit
   * triggers existed, so the timeline is never completely empty.
   */
  fallbackCreatedAt?: string | null;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

const FIELD_LABELS: Record<string, string> = {
  /* properties */
  title: "Título",
  slug: "Slug",
  description: "Descripción",
  type: "Tipo",
  operation: "Operación",
  status: "Estado",
  price: "Precio",
  price_sale: "Precio de venta",
  price_rent: "Precio de renta",
  currency: "Moneda",
  accepts_crypto: "Acepta cripto",
  area_total: "Superficie total",
  area_built: "Superficie construida",
  bedrooms: "Recámaras",
  bathrooms: "Baños",
  half_bathrooms: "Medios baños",
  parking_spaces: "Estacionamientos",
  floors: "Niveles",
  floor_number: "Piso",
  maintenance_fee: "Cuota de mantenimiento",
  address_line: "Dirección",
  neighborhood: "Colonia",
  city: "Ciudad",
  state: "Estado (entidad)",
  zip_code: "Código postal",
  country: "País",
  latitude: "Latitud",
  longitude: "Longitud",
  amenities: "Amenidades",
  featured_image_url: "Imagen principal",
  brc_status: "Estado BRC",
  brc_certificate_id: "Certificado BRC",
  published_at: "Fecha de publicación",
  has_service_room: "Cuarto de servicio",
  has_storage: "Bodega",
  has_terrace: "Terraza",
  has_laundry_room: "Cuarto de lavado",
  has_integrated_kitchen: "Cocina integral",
  show_price: "Mostrar precio",
  show_address: "Mostrar dirección",
  company_id: "Inmobiliaria",
  owner_id: "Propietario",
  /* leads */
  name: "Nombre",
  email: "Email",
  phone: "Teléfono",
  message: "Mensaje",
  source: "Fuente",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "UTM campaign",
  contacted_at: "Fecha de contacto",
  property_id: "Propiedad",
  /* shared */
  created_at: "Fecha de alta",
};

const VALUE_LABELS: Record<string, string> = {
  /* property_status */
  BORRADOR: "Borrador",
  PUBLICADO: "Publicado",
  PAUSADO: "Pausado",
  VENDIDO: "Vendido",
  ELIMINADO: "Eliminado",
  /* lead_status */
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  EN_NEGOCIACION: "En negociación",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
  /* lead_source */
  ORGANICO: "Orgánico",
  CAMPANA: "Campaña",
  REFERIDO: "Referido",
  DIRECTO: "Directo",
  /* property_operation */
  VENTA: "Venta",
  RENTA: "Renta",
  TRASPASO: "Traspaso",
  VENTA_RENTA: "Venta y renta",
  /* property_type */
  CASA: "Casa",
  CASA_CONDOMINIO: "Casa en condominio",
  DEPARTAMENTO: "Departamento",
  DEPARTAMENTO_HOTEL: "Departamento en hotel",
  HOTEL: "Hotel",
  TERRENO: "Terreno",
  OFICINA: "Oficina",
  LOCAL_COMERCIAL: "Local comercial",
  BODEGA: "Bodega",
  OTRO: "Otro",
  /* brc_status */
  NO_SOLICITADO: "No solicitado",
  EN_REVISION: "En revisión",
  DOCUMENTACION_PENDIENTE: "Documentación pendiente",
  VALIDACION_NOTARIAL: "Validación notarial",
  RECHAZADO: "Rechazado",
  CERTIFICADO: "Certificado",
  /* user_role (actor) */
  ADMIN: "Administrador",
  INMOBILIARIA: "Inmobiliaria",
  BROKER: "Broker",
  VENDEDOR: "Vendedor",
  COMPRADOR: "Comprador",
  NOTARIO: "Notario",
  OPERADOR_BRC: "Operador BRC",
};

/** Fields worth surfacing on a CREATED entry (the rest stays hidden). */
const CREATED_HIGHLIGHT: Record<HistorialEntity, string[]> = {
  properties: [
    "title",
    "type",
    "operation",
    "status",
    "price",
    "price_sale",
    "price_rent",
    "city",
    "state",
  ],
  leads: [
    "name",
    "email",
    "phone",
    "source",
    "status",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "message",
  ],
};

/** Columns that are internal plumbing and never interesting to a user. */
const HIDDEN_FIELDS = new Set(["id", "owner_id", "search_vector"]);

const ACTION_META: Record<
  AuditAction,
  { icon: typeof Plus; dot: string; badge: string; label: Record<HistorialEntity, string> }
> = {
  CREATED: {
    icon: Plus,
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600 border-blue-200",
    label: { properties: "Propiedad creada", leads: "Lead recibido" },
  },
  UPDATED: {
    icon: Pencil,
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    label: { properties: "Propiedad editada", leads: "Datos actualizados" },
  },
  STATUS_CHANGED: {
    icon: RefreshCw,
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-600 border-amber-200",
    label: { properties: "Cambio de estado", leads: "Cambio de estado" },
  },
  DELETED: {
    icon: Trash2,
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-600 border-red-200",
    label: { properties: "Propiedad eliminada", leads: "Lead eliminado" },
  },
};

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function formatDateTimeEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(key: string, value: JsonValue | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";

  if (typeof value === "number") {
    if (key.startsWith("price") || key === "maintenance_fee") {
      return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat("es-MX").format(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map((v) => String(v)).join(", ");
  }

  if (typeof value === "object") return JSON.stringify(value);

  /* string */
  if (VALUE_LABELS[value]) return VALUE_LABELS[value];
  if (key.endsWith("_at") || key === "published_at") return formatDateTimeEs(value);
  if (value.length > 140) return `${value.slice(0, 140)}…`;
  return value;
}

function actorLabel(entry: AuditEntry): string {
  if (entry.actorName) {
    return entry.actorRole && VALUE_LABELS[entry.actorRole]
      ? `${entry.actorName} · ${VALUE_LABELS[entry.actorRole]}`
      : entry.actorName;
  }
  /* No profile behind the write: the public lead form (anonymous
     visitor) or a server-side / service-role job. */
  return entry.action === "CREATED" ? "Visitante del sitio" : "Sistema";
}

/** Ordered [key, oldValue, newValue] rows for an entry. */
function diffRows(
  entry: AuditEntry,
  entityType: HistorialEntity,
): { key: string; before: JsonValue | undefined; after: JsonValue | undefined }[] {
  const keys = new Set<string>([
    ...Object.keys(entry.oldData ?? {}),
    ...Object.keys(entry.newData ?? {}),
  ]);

  let visible = [...keys].filter((k) => !HIDDEN_FIELDS.has(k));

  if (entry.action === "CREATED") {
    const highlight = CREATED_HIGHLIGHT[entityType];
    visible = highlight.filter((k) => visible.includes(k));
  } else {
    /* Show the status change first — it is the headline of the entry. */
    visible.sort((a, b) => Number(b === "status") - Number(a === "status"));
  }

  return visible.map((key) => ({
    key,
    before: entry.oldData?.[key],
    after: entry.newData?.[key],
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HistorialTimeline({
  entityType,
  entityId,
  fallbackCreatedAt,
  className,
}: HistorialTimelineProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, actor_name, actor_role, old_data, new_data, created_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      logError("Error fetching entity history:", error);
      setFailed(true);
      setLoading(false);
      return;
    }

    setEntries(
      (data ?? []).map((row) => ({
        id: row.id as string,
        action: row.action as AuditAction,
        actorName: (row.actor_name as string | null) ?? null,
        actorRole: (row.actor_role as string | null) ?? null,
        oldData: (row.old_data as Record<string, JsonValue> | null) ?? null,
        newData: (row.new_data as Record<string, JsonValue> | null) ?? null,
        createdAt: row.created_at as string,
      })),
    );
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-10 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Cargando historial...</span>
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 ${className ?? ""}`}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="text-sm text-amber-700">
          <p className="font-semibold">No se pudo cargar el historial</p>
          <button
            onClick={() => fetchHistory()}
            className="mt-1 text-xs font-semibold underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const hasCreated = entries.some((e) => e.action === "CREATED");

  if (entries.length === 0 && !fallbackCreatedAt) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 ${className ?? ""}`}
      >
        <Clock className="mb-2 h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">Todavía no hay movimientos registrados</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ol className="relative space-y-4 border-l border-gray-200 pl-6">
        {entries.map((entry) => {
          const meta = ACTION_META[entry.action] ?? ACTION_META.UPDATED;
          const Icon = meta.icon;
          const rows = diffRows(entry, entityType);

          return (
            <li key={entry.id} className="relative">
              <span
                className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${meta.dot}`}
              >
                <Icon className="h-2.5 w-2.5 text-white" />
              </span>

              <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold ${meta.badge}`}
                  >
                    {meta.label[entityType]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDateTimeEs(entry.createdAt)}
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-gray-500">
                  Por <span className="font-medium text-gray-700">{actorLabel(entry)}</span>
                </p>

                {rows.length > 0 && (
                  <dl className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {rows.map(({ key, before, after }) => (
                      <div
                        key={key}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
                      >
                        <dt className="font-medium text-gray-500">{fieldLabel(key)}:</dt>
                        <dd className="flex flex-wrap items-baseline gap-1.5 text-gray-700">
                          {entry.action === "CREATED" ? (
                            <span className="font-semibold">{formatValue(key, after)}</span>
                          ) : entry.action === "DELETED" && !entry.newData ? (
                            <span className="font-semibold">{formatValue(key, before)}</span>
                          ) : (
                            <>
                              <span className="text-gray-400 line-through">
                                {formatValue(key, before)}
                              </span>
                              <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
                              <span className="font-semibold">{formatValue(key, after)}</span>
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </li>
          );
        })}

        {/* Rows created before the audit triggers existed have no CREATED
            entry; show the record's own created_at so the timeline still
            has a beginning. */}
        {!hasCreated && fallbackCreatedAt && (
          <li className="relative">
            <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 ring-4 ring-white">
              <Clock className="h-2.5 w-2.5 text-white" />
            </span>
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-500">
                  {entityType === "leads" ? "Lead recibido" : "Propiedad creada"}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDateTimeEs(fallbackCreatedAt)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Registro anterior a la bitácora de cambios; no se guardó el detalle.
              </p>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
