"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { useUser } from "../../_context/user-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  "Casa",
  "Departamento",
  "Terreno",
  "Oficina",
  "Local Comercial",
  "Bodega",
  "Otro",
] as const;

const OPERATION_TYPES = ["Venta", "Renta", "Traspaso"] as const;

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

const AMENITIES = [
  "Alberca",
  "Jardín",
  "Gimnasio",
  "Seguridad 24/7",
  "Estacionamiento techado",
  "Cuarto de servicio",
  "Bodega",
  "Terraza",
  "Sistema de alarma",
  "Cocina integral",
  "Elevador",
  "Roof garden",
  "Área de BBQ",
  "Sala de cine",
  "Cuarto de lavado",
  "Pet friendly",
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/*  Form state interface                                               */
/* ------------------------------------------------------------------ */

interface FormData {
  titulo: string;
  descripcion: string;
  tipo_propiedad: string;
  tipo_operacion: string;
  precio: string;
  moneda: string;
  acepta_crypto: boolean;
  cryptos_aceptadas: string[];
  area_total: string;
  area_construida: string;
  recamaras: string;
  banos: string;
  estacionamientos: string;
  pisos: string;
  direccion: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  amenidades: string[];
}

const initialFormData: FormData = {
  titulo: "",
  descripcion: "",
  tipo_propiedad: "",
  tipo_operacion: "",
  precio: "",
  moneda: "MXN",
  acepta_crypto: false,
  cryptos_aceptadas: [],
  area_total: "",
  area_construida: "",
  recamaras: "",
  banos: "",
  estacionamientos: "",
  pisos: "",
  direccion: "",
  colonia: "",
  ciudad: "",
  estado: "",
  codigo_postal: "",
  amenidades: [],
};

/* ------------------------------------------------------------------ */
/*  Section card wrapper                                               */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <h3
        className="mb-6 text-lg font-bold text-gray-900"
        style={{ fontFamily: "Barlow, Inter, sans-serif" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>(initialFormData);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  const addImages = useCallback(
    (files: FileList | File[]) => {
      const newFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (newFiles.length === 0) return;

      const totalAllowed = 20;
      const remaining = totalAllowed - images.length;
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
    [images.length]
  );

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      addImages(e.dataTransfer.files);
    }
  }

  /* ---- Upload images to Supabase Storage ---- */

  async function uploadImages(propertyId: string): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i]!;
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user?.id}/${propertyId}/${i}.${ext}`;

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
    if (!form.descripcion.trim()) return "La descripción es obligatoria.";
    if (!form.tipo_propiedad) return "Selecciona el tipo de propiedad.";
    if (!form.tipo_operacion) return "Selecciona el tipo de operación.";
    if (!form.precio || Number(form.precio) <= 0) return "Ingresa un precio válido.";
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
      setError("Debes iniciar sesión para publicar una propiedad.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const slug = slugify(form.titulo) + "-" + Date.now().toString(36);

      // Geocode the address (best-effort; if it fails, lat/lng stay null
      // and the detail page falls back to live geocoding).
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
          // Silent: geocoding is non-blocking
        }
      }

      // Insert property first to get ID
      const { data: property, error: insertError } = await supabase
        .from("properties")
        .insert({
          owner_id: user.id,
          title: form.titulo,
          slug,
          description: form.descripcion,
          type: form.tipo_propiedad.toUpperCase(),
          operation: form.tipo_operacion.toUpperCase(),
          price: Number(form.precio),
          currency: form.moneda,
          accepts_crypto: form.acepta_crypto,
          area_total: form.area_total ? Number(form.area_total) : null,
          area_built: form.area_construida ? Number(form.area_construida) : null,
          bedrooms: form.recamaras ? Number(form.recamaras) : null,
          bathrooms: form.banos ? Number(form.banos) : null,
          parking_spaces: form.estacionamientos ? Number(form.estacionamientos) : null,
          floors: form.pisos ? Number(form.pisos) : null,
          address_line: form.direccion || null,
          neighborhood: form.colonia || null,
          city: form.ciudad,
          state: form.estado,
          zip_code: form.codigo_postal || null,
          latitude,
          longitude,
          amenities: form.amenidades,
          status: status === "publicado" ? "PUBLICADO" : "BORRADOR",
          published_at: status === "publicado" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);

      // Upload images if any
      if (images.length > 0 && property) {
        const imageUrls = await uploadImages(property.id);

        // Set featured image
        if (imageUrls[0]) {
          await supabase
            .from("properties")
            .update({ featured_image_url: imageUrls[0] })
            .eq("id", property.id);
        }

        // Insert into property_media table
        const mediaInserts = imageUrls.map((url, idx) => ({
          property_id: property.id,
          url,
          media_type: "IMAGE",
          sort_order: idx,
        }));

        const { error: mediaError } = await supabase
          .from("property_media")
          .insert(mediaInserts);

        if (mediaError) logError("Error saving media:", mediaError);
      }

      setSuccess(
        status === "publicado"
          ? "Propiedad publicada exitosamente."
          : "Borrador guardado exitosamente."
      );

      setTimeout(() => {
        router.push("/dashboard/propiedades");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- Render ---- */

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* ============================================================ */}
      {/*  Header                                                       */}
      {/* ============================================================ */}
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
          Publicar Propiedad
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Completa la información de tu propiedad para publicarla en Bithauss.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  Status messages                                              */}
      {/* ============================================================ */}
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

      {/* ============================================================ */}
      {/*  Información Básica                                           */}
      {/* ============================================================ */}
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

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-gray-700">
                Tipo de propiedad <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.tipo_propiedad}
                onValueChange={(v) => updateField("tipo_propiedad", v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
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
                  {OPERATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Precio                                                       */}
      {/* ============================================================ */}
      <SectionCard title="Precio">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label htmlFor="precio" className="mb-1.5 block text-gray-700">
              Precio <span className="text-red-500">*</span>
            </Label>
            <Input
              id="precio"
              type="number"
              placeholder="0"
              min={0}
              value={form.precio}
              onChange={(e) => updateField("precio", e.target.value)}
              className="rounded-xl"
            />
          </div>

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

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.acepta_crypto}
                onClick={() => updateField("acepta_crypto", !form.acepta_crypto)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                  form.acepta_crypto ? "bg-emerald-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                    form.acepta_crypto ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                Acepta criptomonedas
              </span>
            </label>
          </div>
        </div>

        {/* Crypto selection */}
        {form.acepta_crypto && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">¿Qué criptomonedas acepta?</p>
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
                        : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300"
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
      </SectionCard>

      {/* ============================================================ */}
      {/*  Características                                              */}
      {/* ============================================================ */}
      <SectionCard title="Características">
        <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="area_total" className="mb-1.5 block text-gray-700">
              Área total m²
            </Label>
            <Input
              id="area_total"
              type="number"
              placeholder="0"
              min={0}
              value={form.area_total}
              onChange={(e) => updateField("area_total", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="area_construida" className="mb-1.5 block text-gray-700">
              Área construida m²
            </Label>
            <Input
              id="area_construida"
              type="number"
              placeholder="0"
              min={0}
              value={form.area_construida}
              onChange={(e) => updateField("area_construida", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="recamaras" className="mb-1.5 block text-gray-700">
              Recámaras
            </Label>
            <Input
              id="recamaras"
              type="number"
              placeholder="0"
              min={0}
              value={form.recamaras}
              onChange={(e) => updateField("recamaras", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="banos" className="mb-1.5 block text-gray-700">
              Baños
            </Label>
            <Input
              id="banos"
              type="number"
              placeholder="0"
              min={0}
              step={0.5}
              value={form.banos}
              onChange={(e) => updateField("banos", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="estacionamientos" className="mb-1.5 block text-gray-700">
              Estacionamientos
            </Label>
            <Input
              id="estacionamientos"
              type="number"
              placeholder="0"
              min={0}
              value={form.estacionamientos}
              onChange={(e) => updateField("estacionamientos", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="pisos" className="mb-1.5 block text-gray-700">
              Pisos
            </Label>
            <Input
              id="pisos"
              type="number"
              placeholder="0"
              min={0}
              value={form.pisos}
              onChange={(e) => updateField("pisos", e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Ubicación                                                    */}
      {/* ============================================================ */}
      <SectionCard title="Ubicación">
        <div className="space-y-5">
          <div>
            <Label htmlFor="direccion" className="mb-1.5 block text-gray-700">
              Dirección
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
              <Select
                value={form.estado}
                onValueChange={(v) => updateField("estado", v)}
              >
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
        </div>
      </SectionCard>

      {/* ============================================================ */}
      {/*  Amenidades                                                   */}
      {/* ============================================================ */}
      <SectionCard title="Amenidades">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {AMENITIES.map((amenity) => {
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
                    checked
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {checked && (
                    <svg
                      className="h-3 w-3 text-white"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
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

      {/* ============================================================ */}
      {/*  Imágenes                                                     */}
      {/* ============================================================ */}
      <SectionCard title="Imágenes">
        <div className="space-y-5">
          {/* Drop zone */}
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

          {/* Preview grid */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {imagePreviews.map((src, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                >
                  <Image
                    src={src}
                    alt={`Imagen ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
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

      {/* ============================================================ */}
      {/*  Action Buttons                                               */}
      {/* ============================================================ */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Publicar propiedad
        </button>
      </div>
    </div>
  );
}
