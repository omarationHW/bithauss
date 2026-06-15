"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Clock,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { useUser } from "../../../_context/user-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldBrc } from "@/components/ui/shield-brc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROPERTY_TYPES = [
  { value: "CASA", label: "Casa" },
  { value: "DEPARTAMENTO", label: "Departamento" },
  { value: "TERRENO", label: "Terreno" },
  { value: "OFICINA", label: "Oficina" },
  { value: "LOCAL_COMERCIAL", label: "Local Comercial" },
  { value: "BODEGA", label: "Bodega" },
  { value: "OTRO", label: "Otro" },
] as const;

const OPERATION_TYPES = [
  { value: "VENTA", label: "Venta" },
  { value: "RENTA", label: "Renta" },
  { value: "VENTA_RENTA", label: "Venta y Renta" },
  { value: "TRASPASO", label: "Traspaso" },
] as const;

const CURRENCIES = ["MXN", "USD", "EUR"] as const;
const CRYPTOS = [
  { id: "BTC", label: "Bitcoin (BTC)" },
  { id: "ETH", label: "Ethereum (ETH)" },
  { id: "USDC", label: "USD Coin (USDC)" },
] as const;

const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

const COMMON_AREAS = [
  "Alberca",
  "Jardín",
  "Gimnasio",
  "Seguridad 24/7",
  "Estacionamiento techado para visitas",
  "Sistema de alarma",
  "Elevador",
  "Roof garden",
  "Área de BBQ",
  "Sala de cine",
  "Pet friendly",
  "Salón de eventos",
  "Cancha deportiva",
  "Área de juegos infantiles",
] as const;

type PrivateFeatureKey =
  | "has_service_room"
  | "has_storage"
  | "has_terrace"
  | "has_laundry_room"
  | "has_integrated_kitchen";

const PRIVATE_FEATURES: { key: PrivateFeatureKey; label: string }[] = [
  { key: "has_service_room", label: "Cuarto de servicio" },
  { key: "has_storage", label: "Bodega" },
  { key: "has_terrace", label: "Terraza" },
  { key: "has_laundry_room", label: "Cuarto de lavado" },
  { key: "has_integrated_kitchen", label: "Cocina integral" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asNum(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tolerate the legacy display values (e.g. "Casa", "Local Comercial") that
 * may still exist in the DB from rows created with the previous form.
 */
function normalizeType(dbValue: string | null | undefined): string {
  if (!dbValue) return "";
  const map: Record<string, string> = {
    "Local Comercial": "LOCAL_COMERCIAL",
  };
  if (map[dbValue]) return map[dbValue];
  return dbValue.toUpperCase().replace(/\s+/g, "_");
}

function normalizeOperation(dbValue: string | null | undefined): string {
  if (!dbValue) return "";
  return dbValue.toUpperCase().replace(/\s+/g, "_");
}

/* ------------------------------------------------------------------ */
/*  Form state                                                         */
/* ------------------------------------------------------------------ */

interface FormData {
  titulo: string;
  descripcion: string;
  tipo_propiedad: string;
  tipo_operacion: string;
  precio_venta: string;
  precio_renta: string;
  moneda: string;
  acepta_crypto: boolean;
  cryptos_aceptadas: string[];
  show_price: boolean;
  area_total: string;
  area_construida: string;
  recamaras: string;
  banos: string;
  medios_banos: string;
  estacionamientos: string;
  niveles: string;
  piso: string;
  cuota_mantenimiento: string;
  has_service_room: boolean;
  has_storage: boolean;
  has_terrace: boolean;
  has_laundry_room: boolean;
  has_integrated_kitchen: boolean;
  direccion: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  show_address: boolean;
  amenidades: string[];
}

const initialFormData: FormData = {
  titulo: "",
  descripcion: "",
  tipo_propiedad: "",
  tipo_operacion: "",
  precio_venta: "",
  precio_renta: "",
  moneda: "MXN",
  acepta_crypto: false,
  cryptos_aceptadas: [],
  show_price: true,
  area_total: "",
  area_construida: "",
  recamaras: "",
  banos: "",
  medios_banos: "",
  estacionamientos: "",
  niveles: "",
  piso: "",
  cuota_mantenimiento: "",
  has_service_room: false,
  has_storage: false,
  has_terrace: false,
  has_laundry_room: false,
  has_integrated_kitchen: false,
  direccion: "",
  colonia: "",
  ciudad: "",
  estado: "",
  codigo_postal: "",
  show_address: true,
  amenidades: [],
};

/* ------------------------------------------------------------------ */
/*  UI bits                                                            */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <h3
        className="text-lg font-bold text-gray-900"
        style={{ fontFamily: "Barlow, Inter, sans-serif" }}
      >
        {title}
      </h3>
      {subtitle && <p className="mt-1 mb-5 text-xs text-gray-500">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? "bg-emerald-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm">
        <span className="block font-medium text-gray-700">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EditarPropiedadPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>(initialFormData);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingMediaIds, setExistingMediaIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [originalSlug, setOriginalSlug] = useState<string>("");
  const [, setOriginalStatus] = useState<string>("");
  const [brcStatus, setBrcStatus] = useState<string>("NO_SOLICITADO");

  const isCasa = form.tipo_propiedad === "CASA";
  const isDepto = form.tipo_propiedad === "DEPARTAMENTO";
  const isResidential = isCasa || isDepto;
  const hasSale =
    form.tipo_operacion === "VENTA" ||
    form.tipo_operacion === "VENTA_RENTA" ||
    form.tipo_operacion === "TRASPASO";
  const hasRent =
    form.tipo_operacion === "RENTA" || form.tipo_operacion === "VENTA_RENTA";

  /* ---- Fetch existing property ---- */

  useEffect(() => {
    if (!propertyId) return;

    async function fetchProperty() {
      const supabase = createClient();

      const { data: property, error: fetchError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .single();

      if (fetchError || !property) {
        setError("No se pudo cargar la propiedad.");
        setLoading(false);
        return;
      }

      setOriginalSlug(property.slug ?? "");
      setOriginalStatus(property.status ?? "");
      setBrcStatus(property.brc_status ?? "NO_SOLICITADO");

      const op = normalizeOperation(property.operation);
      // For legacy rows that only have `price`, surface it in whichever
      // bucket matches the operation so the editor doesn't lose the value.
      const legacyPrice = property.price != null ? String(property.price) : "";
      const priceSaleStr =
        property.price_sale != null
          ? String(property.price_sale)
          : op === "VENTA" || op === "TRASPASO"
            ? legacyPrice
            : "";
      const priceRentStr =
        property.price_rent != null
          ? String(property.price_rent)
          : op === "RENTA"
            ? legacyPrice
            : "";

      setForm({
        titulo: property.title ?? "",
        descripcion: property.description ?? "",
        tipo_propiedad: normalizeType(property.type),
        tipo_operacion: op,
        precio_venta: priceSaleStr,
        precio_renta: priceRentStr,
        moneda: property.currency ?? "MXN",
        acepta_crypto: property.accepts_crypto ?? false,
        cryptos_aceptadas: Array.isArray(property.cryptos_accepted)
          ? property.cryptos_accepted
          : [],
        show_price: property.show_price ?? true,
        area_total: property.area_total != null ? String(property.area_total) : "",
        area_construida: property.area_built != null ? String(property.area_built) : "",
        recamaras: property.bedrooms != null ? String(property.bedrooms) : "",
        banos: property.bathrooms != null ? String(property.bathrooms) : "",
        medios_banos:
          property.half_bathrooms != null ? String(property.half_bathrooms) : "",
        estacionamientos:
          property.parking_spaces != null ? String(property.parking_spaces) : "",
        niveles: property.floors != null ? String(property.floors) : "",
        piso:
          property.floor_number != null ? String(property.floor_number) : "",
        cuota_mantenimiento:
          property.maintenance_fee != null
            ? String(property.maintenance_fee)
            : "",
        has_service_room: property.has_service_room ?? false,
        has_storage: property.has_storage ?? false,
        has_terrace: property.has_terrace ?? false,
        has_laundry_room: property.has_laundry_room ?? false,
        has_integrated_kitchen: property.has_integrated_kitchen ?? false,
        direccion: property.address_line ?? "",
        colonia: property.neighborhood ?? "",
        ciudad: property.city ?? "",
        estado: property.state ?? "",
        codigo_postal: property.zip_code ?? "",
        show_address: property.show_address ?? true,
        amenidades: Array.isArray(property.amenities) ? property.amenities : [],
      });

      const { data: media } = await supabase
        .from("property_media")
        .select("id, url, sort_order")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });

      if (media && media.length > 0) {
        setExistingImageUrls(media.map((m) => m.url));
        setExistingMediaIds(media.map((m) => m.id));
        setImagePreviews(media.map((m) => m.url));
      }

      setLoading(false);
    }

    fetchProperty();
  }, [propertyId]);

  /* ---- Field helpers ---- */

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(amenity: string) {
    setForm((prev) => ({
      ...prev,
      amenidades: prev.amenidades.includes(amenity)
        ? prev.amenidades.filter((a) => a !== amenity)
        : [...prev.amenidades, amenity],
    }));
  }

  /* ---- Image handling ---- */

  const totalImageCount = existingImageUrls.length + images.length;

  const addImages = useCallback(
    (files: FileList | File[]) => {
      const newFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (newFiles.length === 0) return;

      const totalAllowed = 20;
      const remaining = totalAllowed - totalImageCount;
      const toAdd = newFiles.slice(0, remaining);

      setImages((prev) => [...prev, ...toAdd]);

      toAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    },
    [totalImageCount]
  );

  function removeImage(index: number) {
    if (index < existingImageUrls.length) {
      setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
      setExistingMediaIds((prev) => prev.filter((_, i) => i !== index));
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    } else {
      const newIndex = index - existingImageUrls.length;
      setImages((prev) => prev.filter((_, i) => i !== newIndex));
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      addImages(e.dataTransfer.files);
    }
  }

  /* ---- Upload new images to Supabase Storage ---- */

  async function uploadImages(propId: string): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i]!;
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user?.id}/${propId}/${Date.now()}_${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("properties")
        .upload(path, file as File, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        throw new Error(`Error subiendo imagen ${i + 1}: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("properties").getPublicUrl(path);

      urls.push(publicUrl);
    }

    return urls;
  }

  /* ---- Validate ---- */

  function validate(): string | null {
    if (!form.titulo.trim()) return "El título es obligatorio.";
    if (!form.tipo_propiedad) return "Selecciona el tipo de inmueble.";
    if (!form.tipo_operacion) return "Selecciona el tipo de operación.";
    if (!form.descripcion.trim()) return "La descripción es obligatoria.";

    if (hasSale && (!form.precio_venta || Number(form.precio_venta) <= 0)) {
      return "Ingresa un precio de venta válido.";
    }
    if (hasRent && (!form.precio_renta || Number(form.precio_renta) <= 0)) {
      return "Ingresa un precio de renta válido.";
    }

    if (isCasa) {
      if (!form.area_total || Number(form.area_total) <= 0) {
        return "Ingresa los m² de terreno.";
      }
      if (!form.area_construida || Number(form.area_construida) <= 0) {
        return "Ingresa los m² de construcción.";
      }
    }
    if (isDepto) {
      if (!form.area_construida || Number(form.area_construida) <= 0) {
        return "Ingresa el área construida.";
      }
    }

    if (!form.ciudad.trim()) return "La ciudad es obligatoria.";
    if (!form.estado) return "Selecciona el estado.";
    if (form.codigo_postal && !/^\d{5}$/.test(form.codigo_postal)) {
      return "El código postal debe tener 5 dígitos.";
    }
    return null;
  }

  /* ---- Submit ---- */

  async function handleSubmit(status: "borrador" | "publicado") {
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!user) {
      setError("Debes iniciar sesión para editar una propiedad.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      const slug = originalSlug || slugify(form.titulo) + "-" + Date.now().toString(36);

      let latitude: number | null = null;
      let longitude: number | null = null;
      const addressQuery = [
        form.direccion,
        form.colonia,
        form.ciudad,
        form.estado,
        form.codigo_postal ? `C.P. ${form.codigo_postal}` : "",
        "México",
      ]
        .filter(Boolean)
        .join(", ");
      if (addressQuery) {
        try {
          const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(addressQuery)}`);
          if (geoRes.ok) {
            const geo = await geoRes.json();
            if (geo?.result?.lat && geo?.result?.lng) {
              latitude = geo.result.lat;
              longitude = geo.result.lng;
            }
          }
        } catch {
          // Silent
        }
      }

      const price_sale = hasSale ? asNum(form.precio_venta) : null;
      const price_rent = hasRent ? asNum(form.precio_renta) : null;
      const legacyPrice = price_sale ?? price_rent;

      const updatePayload: Record<string, unknown> = {
        title: form.titulo,
        slug,
        description: form.descripcion,
        type: form.tipo_propiedad,
        operation: form.tipo_operacion,
        price: legacyPrice,
        price_sale,
        price_rent,
        currency: form.moneda,
        accepts_crypto: form.acepta_crypto,
        show_price: form.show_price,
        area_total: asNum(form.area_total),
        area_built: asNum(form.area_construida),
        bedrooms: asNum(form.recamaras),
        bathrooms: asNum(form.banos),
        half_bathrooms: asNum(form.medios_banos),
        parking_spaces: asNum(form.estacionamientos),
        floors: asNum(form.niveles),
        floor_number: isDepto ? asNum(form.piso) : null,
        maintenance_fee: isDepto ? asNum(form.cuota_mantenimiento) : null,
        has_service_room: form.has_service_room,
        has_storage: form.has_storage,
        has_terrace: form.has_terrace,
        has_laundry_room: form.has_laundry_room,
        has_integrated_kitchen: form.has_integrated_kitchen,
        address_line: form.direccion || null,
        neighborhood: form.colonia || null,
        city: form.ciudad,
        state: form.estado,
        zip_code: form.codigo_postal || null,
        show_address: form.show_address,
        amenities: form.amenidades,
        status: status === "publicado" ? "PUBLICADO" : "BORRADOR",
        published_at: status === "publicado" ? new Date().toISOString() : null,
      };
      if (latitude !== null && longitude !== null) {
        updatePayload.latitude = latitude;
        updatePayload.longitude = longitude;
      }

      const { error: updateError } = await supabase
        .from("properties")
        .update(updatePayload)
        .eq("id", propertyId);

      if (updateError) throw new Error(updateError.message);

      // Media: delete removed existing rows
      const { data: currentMedia } = await supabase
        .from("property_media")
        .select("id")
        .eq("property_id", propertyId);

      if (currentMedia) {
        const idsToKeep = new Set(existingMediaIds);
        const idsToDelete = currentMedia
          .map((m) => m.id)
          .filter((id) => !idsToKeep.has(id));

        if (idsToDelete.length > 0) {
          await supabase.from("property_media").delete().in("id", idsToDelete);
        }
      }

      if (images.length > 0) {
        const newImageUrls = await uploadImages(propertyId);
        const startSortOrder = existingImageUrls.length;
        const mediaInserts = newImageUrls.map((url, idx) => ({
          property_id: propertyId,
          url,
          media_type: "IMAGE",
          sort_order: startSortOrder + idx,
        }));

        const { error: mediaError } = await supabase
          .from("property_media")
          .insert(mediaInserts);

        if (mediaError) logError("Error saving media:", mediaError);
      }

      // Refresh featured image
      const allImageUrls = [...existingImageUrls];
      if (images.length > 0) {
        const { data: allMedia } = await supabase
          .from("property_media")
          .select("url")
          .eq("property_id", propertyId)
          .order("sort_order", { ascending: true })
          .limit(1);

        if (allMedia && allMedia[0]) {
          await supabase
            .from("properties")
            .update({ featured_image_url: allMedia[0].url })
            .eq("id", propertyId);
        }
      } else if (allImageUrls.length > 0) {
        await supabase
          .from("properties")
          .update({ featured_image_url: allImageUrls[0] })
          .eq("id", propertyId);
      } else {
        await supabase
          .from("properties")
          .update({ featured_image_url: null })
          .eq("id", propertyId);
      }

      setSuccess(
        status === "publicado"
          ? "Propiedad actualizada y publicada exitosamente."
          : "Borrador guardado exitosamente."
      );

      setTimeout(() => {
        router.push("/dashboard/propiedades");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Loading state ---- */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Cargando propiedad...</p>
        </div>
      </div>
    );
  }

  /* ---- Render ---- */

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/propiedades"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a propiedades
        </Link>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Editar Propiedad
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Modifica la información de tu propiedad.
        </p>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* BRC Certification Status Banner */}
      {brcStatus === "NO_SOLICITADO" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "hsl(45 93% 47% / 0.15)" }}
              >
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4
                  className="font-bold text-amber-800"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Sin certificación BRC
                </h4>
                <p className="mt-0.5 text-sm text-amber-700">
                  Esta propiedad aún no cuenta con certificación BRC. La certificación
                  aumenta la confianza de los compradores y mejora la visibilidad.
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/propiedades/${propertyId}/solicitar-brc`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            >
              <ShieldBrc className="h-4 w-4" />
              Solicitar certificación BRC
            </Link>
          </div>
        </div>
      )}

      {brcStatus === "EN_REVISION" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "hsl(221 83% 53% / 0.15)" }}
            >
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4
                className="font-bold text-blue-800"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Certificación BRC en revisión
              </h4>
              <p className="mt-0.5 text-sm text-blue-700">
                Tu solicitud está siendo procesada. Te notificaremos cuando haya una
                actualización.
              </p>
            </div>
          </div>
        </div>
      )}

      {brcStatus === "CERTIFICADO" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "hsl(160 84% 39% / 0.15)" }}
            >
              <ShieldBrc className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h4
                className="font-bold text-emerald-800"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Propiedad Certificada BRC
              </h4>
              <p className="mt-0.5 text-sm text-emerald-700">
                Documentación legal verificada por Notario Público.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Información Básica */}
      <SectionCard title="Información Básica">
        <div className="space-y-5">
          <div>
            <Label htmlFor="titulo" className="mb-1.5 block text-gray-700">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="titulo"
              placeholder="Ej. Departamento en Polanco con vista al parque"
              value={form.titulo}
              onChange={(e) => updateField("titulo", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-gray-700">
                Tipo de inmueble <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.tipo_propiedad}
                onValueChange={(v) => updateField("tipo_propiedad", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-gray-700">
                Tipo de operación <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.tipo_operacion}
                onValueChange={(v) => updateField("tipo_operacion", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar operación" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATION_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="descripcion" className="mb-1.5 block text-gray-700">
              Descripción <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Describe las características principales, acabados, distribución y atractivos de la propiedad..."
              value={form.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
              rows={6}
              className="rounded-xl"
            />
          </div>
        </div>
      </SectionCard>

      {/* Precio */}
      <SectionCard
        title="Precio"
        subtitle="Si desactivas la publicación del precio, los visitantes verán 'Precio a consultar'."
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            {hasSale && (
              <div>
                <Label htmlFor="precio_venta" className="mb-1.5 block text-gray-700">
                  Precio de venta <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="precio_venta"
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.precio_venta}
                  onChange={(e) => updateField("precio_venta", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            {hasRent && (
              <div>
                <Label htmlFor="precio_renta" className="mb-1.5 block text-gray-700">
                  Precio de renta (mensual) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="precio_renta"
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.precio_renta}
                  onChange={(e) => updateField("precio_renta", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            <div>
              <Label className="mb-1.5 block text-gray-700">Moneda</Label>
              <Select
                value={form.moneda}
                onValueChange={(v) => updateField("moneda", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Toggle
              checked={form.show_price}
              onChange={(v) => updateField("show_price", v)}
              label="Publicar precio"
              hint="Si lo desactivas, en la propiedad pública aparecerá 'Precio a consultar'."
            />

            {hasSale && (
              <Toggle
                checked={form.acepta_crypto}
                onChange={(v) => updateField("acepta_crypto", v)}
                label="Acepta criptomonedas"
              />
            )}
          </div>

          {form.acepta_crypto && hasSale && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-700">
                ¿Qué criptomonedas acepta?
              </p>
              <div className="flex flex-wrap gap-3">
                {CRYPTOS.map((crypto) => {
                  const selected = form.cryptos_aceptadas.includes(crypto.id);
                  return (
                    <button
                      key={crypto.id}
                      type="button"
                      onClick={() => {
                        const updated = selected
                          ? form.cryptos_aceptadas.filter((c) => c !== crypto.id)
                          : [...form.cryptos_aceptadas, crypto.id];
                        updateField("cryptos_aceptadas", updated);
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                        selected
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
                      }`}
                    >
                      {crypto.id === "BTC" && "₿"}
                      {crypto.id === "ETH" && "Ξ"}
                      {crypto.id === "USDC" && "$"}
                      {crypto.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Características */}
      {form.tipo_propiedad && (
        <SectionCard title="Características">
          {isCasa && (
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  m² de terreno <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.area_total}
                  onChange={(e) => updateField("area_total", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  m² de construcción <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.area_construida}
                  onChange={(e) => updateField("area_construida", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Recámaras</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.recamaras}
                  onChange={(e) => updateField("recamaras", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Baños completos</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.banos}
                  onChange={(e) => updateField("banos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Medios baños</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.medios_banos}
                  onChange={(e) => updateField("medios_banos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Estacionamientos</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.estacionamientos}
                  onChange={(e) => updateField("estacionamientos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Niveles</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.niveles}
                  onChange={(e) => updateField("niveles", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}

          {isDepto && (
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  Área construida (m²) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.area_construida}
                  onChange={(e) => updateField("area_construida", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  Área total (m²){" "}
                  <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.area_total}
                  onChange={(e) => updateField("area_total", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Recámaras</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.recamaras}
                  onChange={(e) => updateField("recamaras", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Baños completos</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.banos}
                  onChange={(e) => updateField("banos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Medios baños</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.medios_banos}
                  onChange={(e) => updateField("medios_banos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Estacionamientos</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.estacionamientos}
                  onChange={(e) => updateField("estacionamientos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Niveles del depto</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.niveles}
                  onChange={(e) => updateField("niveles", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  Piso en el que está{" "}
                  <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.piso}
                  onChange={(e) => updateField("piso", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  Cuota de mantenimiento (MXN){" "}
                  <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.cuota_mantenimiento}
                  onChange={(e) => updateField("cuota_mantenimiento", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}

          {!isCasa && !isDepto && (
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
              <div>
                <Label className="mb-1.5 block text-gray-700">Área total (m²)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.area_total}
                  onChange={(e) => updateField("area_total", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">
                  Área construida (m²)
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.area_construida}
                  onChange={(e) => updateField("area_construida", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-gray-700">Estacionamientos</Label>
                <Input
                  type="number"
                  placeholder="0"
                  min={0}
                  value={form.estacionamientos}
                  onChange={(e) => updateField("estacionamientos", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Características del inmueble (private features) */}
      {isResidential && (
        <SectionCard
          title="Características del inmueble"
          subtitle="Espacios privados del inmueble (no son áreas comunes del edificio)."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PRIVATE_FEATURES.map(({ key, label }) => {
              const checked = form[key];
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    checked
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => updateField(key, !checked)}
                    className="sr-only"
                  />
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200 ${
                      checked
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {checked && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M10 3L4.5 8.5L2 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="leading-tight">{label}</span>
                </label>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Ubicación */}
      <SectionCard
        title="Ubicación"
        subtitle="La dirección exacta solo se usa para geolocalizar. Puedes ocultarla del público y mostrar solo colonia y ciudad."
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="direccion" className="mb-1.5 block text-gray-700">
              Dirección{" "}
              <span className="text-xs font-normal text-gray-400">(uso interno)</span>
            </Label>
            <Input
              id="direccion"
              placeholder="Calle, número exterior e interior"
              value={form.direccion}
              onChange={(e) => updateField("direccion", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="colonia" className="mb-1.5 block text-gray-700">
                Colonia
              </Label>
              <Input
                id="colonia"
                placeholder="Nombre de la colonia"
                value={form.colonia}
                onChange={(e) => updateField("colonia", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="ciudad" className="mb-1.5 block text-gray-700">
                Ciudad <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ciudad"
                placeholder="Ej. Ciudad de México"
                value={form.ciudad}
                onChange={(e) => updateField("ciudad", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-gray-700">
                Estado <span className="text-red-500">*</span>
              </Label>
              <Select value={form.estado} onValueChange={(v) => updateField("estado", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                  {MEXICAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="codigo_postal" className="mb-1.5 block text-gray-700">
                Código postal
              </Label>
              <Input
                id="codigo_postal"
                placeholder="00000"
                maxLength={5}
                value={form.codigo_postal}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                  updateField("codigo_postal", val);
                }}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <Toggle
              checked={form.show_address}
              onChange={(v) => updateField("show_address", v)}
              label="Mostrar dirección exacta al público"
              hint="Si lo desactivas, los visitantes solo verán colonia y ciudad, y el mapa centrará en la colonia."
            />
          </div>
        </div>
      </SectionCard>

      {/* Amenidades / Áreas comunes */}
      <SectionCard
        title="Amenidades / Áreas comunes"
        subtitle="Áreas y servicios compartidos del edificio o fraccionamiento."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COMMON_AREAS.map((amenity) => {
            const checked = form.amenidades.includes(amenity);
            return (
              <label
                key={amenity}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  checked
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAmenity(amenity)}
                  className="sr-only"
                />
                <div
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200 ${
                    checked ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                  }`}
                >
                  {checked && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span className="leading-tight">{amenity}</span>
              </label>
            );
          })}
        </div>
      </SectionCard>

      {/* Imágenes */}
      <SectionCard title="Imágenes">
        <div className="space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${
              dragOver
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            }`}
          >
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
              }}
            >
              <ImagePlus className="h-6 w-6" style={{ color: "hsl(221 83% 53%)" }} />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              Arrastra tus imágenes aquí o haz clic para seleccionar
            </p>
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG o WebP. Máximo 20 imágenes. La primera será la imagen principal.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) addImages(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {imagePreviews.map((src, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                >
                  <Image src={src} alt={`Imagen ${idx + 1}`} fill className="object-cover" />
                  {idx === 0 && (
                    <span className="absolute left-2 top-2 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(idx);
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard/propiedades"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
        >
          Cancelar
        </Link>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit("borrador")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Guardar como borrador
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit("publicado")}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
