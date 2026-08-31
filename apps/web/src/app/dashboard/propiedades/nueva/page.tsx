"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  applyWatermarkDetailed,
  loadWatermarkConfig,
  isWatermarkActive,
  watermarkSignature,
  watermarkStoragePath,
  originalStoragePath,
  newPhotoKey,
  WM_BUCKET,
  DEFAULT_WATERMARK_CONFIG,
  type WatermarkConfig,
} from "@/lib/watermark";
import { logError } from "@/lib/log";
import { getPropertyTypeFlags } from "@/lib/property-types";
import {
  isFieldVisible,
  isFieldRequired,
  type PropertyFieldError,
} from "@/lib/property-fields";
import { useUser } from "../../_context/user-context";
import {
  PropertyFieldsSection,
  AmenitiesAnsweredField,
  EMPTY_PROPERTY_FIELD_VALUES,
  clearHiddenFieldValues,
  clearHiddenAmenities,
  validatePropertyFieldValues,
  propertyFieldValuesToDb,
  focusFirstInvalidField,
  type PropertyFieldValues,
  type SectionFieldKey,
} from "@/components/propiedades/property-fields-section";
import {
  PhotoManager,
  MAX_PROPERTY_IMAGES,
  moveItem,
  promoteToFront,
  type PhotoItem,
} from "@/components/propiedades/photo-manager";
import {
  VideoManager,
  hasPendingVideoUploads,
  type PropertyVideoDraft,
} from "@/components/propiedades/video-manager";
import { uploadPropertyVideo } from "@/lib/video-upload";
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
import {
  LocationPicker,
  INITIAL_LOCATION_STATUS,
  validateLocation,
  type LocationStatus,
  type LocationValue,
} from "@/components/ui/location-picker";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROPERTY_TYPES = [
  { value: "CASA", label: "Casa" },
  { value: "CASA_CONDOMINIO", label: "Casa en Condominio" },
  { value: "CASA_USO_SUELO", label: "Casa con Uso de Suelo" },
  { value: "DEPARTAMENTO", label: "Departamento" },
  { value: "TERRENO", label: "Terreno" },
  { value: "OFICINA", label: "Oficina" },
  { value: "LOCAL_COMERCIAL", label: "Local Comercial" },
  { value: "BODEGA", label: "Bodega" },
  { value: "NAVE_INDUSTRIAL", label: "Nave Industrial" },
  { value: "HOTEL", label: "Hotel" },
  { value: "EDIFICIO", label: "Edificio" },
  { value: "OTRO", label: "Otro" },
] as const;

/**
 * TRASPASO is gone: the client asked to drop it as an operation ("en la parte
 * para dar de alta una propiedad sugiero eliminar la opción de Traspaso"). It
 * became the matrix row "¿Aplica traspaso?" on Local Comercial instead. The
 * value survives in the Postgres enum for historical rows — see
 * LEGACY_PROPERTY_OPERATIONS in @bithauss/validators.
 */
const OPERATION_TYPES = [
  { value: "VENTA", label: "Venta" },
  { value: "RENTA", label: "Renta" },
  { value: "VENTA_RENTA", label: "Venta y Renta" },
] as const;

/** Matrix row "Moneda: Pesos / USD" — EUR was never accepted by the validator. */
const CURRENCIES = ["MXN", "USD"] as const;
const CRYPTOS = [
  { id: "BTC", label: "Bitcoin (BTC)" },
  { id: "ETH", label: "Ethereum (ETH)" },
  { id: "USDC", label: "USD Coin (USDC)" },
] as const;

/**
 * Common areas / amenities — these are SHARED building amenities, not
 * private features of the unit. Private features (cuarto de servicio,
 * bodega, terraza, cuarto de lavado, cocina integral) are dedicated
 * booleans below.
 */
const COMMON_AREAS = [
  "Alberca",
  "Gimnasio",
  "Roof garden",
  "Áreas verdes / Jardines comunes",
  "Área de BBQ / Asador",
  "Salón de eventos",
  "Salón de juegos",
  "Sala de cine",
  "Área de juegos infantiles",
  "Cancha de paddle",
  "Cancha de tenis",
  "Cancha múltiple",
  "Spa / Sauna",
  "Coworking / Business center",
  "Lobby con recepción",
  "Elevador",
  "Seguridad 24/7",
  "Estacionamiento de visitas",
  "Cuarto de bicicletas",
  "Lavandería común",
  "Pet friendly",
] as const;

/**
 * Extra private features that the client's matrix does not cover.
 *
 * "Terraza" used to live here as a plain checkbox; it is a matrix row now
 * ("forzar a responder") and is rendered as a Sí/No control by
 * <PropertyFieldsSection>. Keeping it in both places would mean two controls
 * writing `has_terrace`.
 */
type PrivateFeatureKey =
  | "has_service_room"
  | "has_storage"
  | "has_laundry_room"
  | "has_integrated_kitchen";

const PRIVATE_FEATURES: { key: PrivateFeatureKey; label: string }[] = [
  { key: "has_service_room", label: "Cuarto de servicio" },
  { key: "has_storage", label: "Bodega" },
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

/* ------------------------------------------------------------------ */
/*  Form state                                                         */
/* ------------------------------------------------------------------ */

/** A photo queued for upload: the file plus its data-URL preview. */
interface NewImage {
  file: File;
  preview: string;
}

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
  /**
   * The conditional rows of the client's matrix. One object instead of nine
   * loose strings so switching property type can clear exactly the fields
   * that stopped applying.
   */
  fields: PropertyFieldValues;
  has_service_room: boolean;
  has_storage: boolean;
  has_laundry_room: boolean;
  has_integrated_kitchen: boolean;
  direccion: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  show_address: boolean;
  amenidades: string[];
  /** Matrix row "Amenidades" is "forzar a responder": confirm the selection. */
  amenidades_confirmadas: boolean;
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
  fields: EMPTY_PROPERTY_FIELD_VALUES,
  has_service_room: false,
  has_storage: false,
  has_laundry_room: false,
  has_integrated_kitchen: false,
  direccion: "",
  colonia: "",
  ciudad: "",
  estado: "",
  codigo_postal: "",
  show_address: true,
  amenidades: [],
  amenidades_confirmadas: false,
};

/* ------------------------------------------------------------------ */
/*  Section card wrapper                                               */
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
      {subtitle && (
        <p className="mt-1 mb-5 text-xs text-gray-500">{subtitle}</p>
      )}
      {!subtitle && <div className="mb-5" />}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch (small reusable)                                     */
/* ------------------------------------------------------------------ */

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

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const { user } = useUser();

  const [form, setForm] = useState<FormData>(initialFormData);
  // Single ordered list so the preview grid can never drift out of sync with
  // the files that get uploaded. Index 0 is the principal/cover photo.
  const [images, setImages] = useState<NewImage[]>([]);
  // Video is not a per-type matrix field, so it keeps its own state and never
  // touches `form.fields`.
  const [videos, setVideos] = useState<PropertyVideoDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<WatermarkConfig>(
    DEFAULT_WATERMARK_CONFIG
  );

  // Load the user's watermark configuration so new photos can be stamped.
  useEffect(() => {
    loadWatermarkConfig().then(setWatermark);
  }, []);

  /* ---- Video ---- */

  /**
   * Storage prefix for videos uploaded from THIS form.
   *
   * The property row does not exist yet when the upload starts — and it must
   * start immediately, because a 200 MB file cannot be uploaded silently
   * during submit. The object still lands under the uploader's own uid, which
   * is what the Storage policy authorises, so the missing property id costs us
   * nothing in terms of access control.
   */
  const videoDraftKeyRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `draft-${crypto.randomUUID()}`
      : `draft-${Date.now()}`
  );

  const startVideoUpload = useCallback(
    (file: File, onProgress: (percent: number) => void, contentType?: string) => {
      const { promise, abort } = uploadPropertyVideo({
        userId: user?.id ?? "",
        propertyKey: videoDraftKeyRef.current,
        file,
        onProgress,
        contentType,
      });
      return { promise, abort };
    },
    [user?.id]
  );

  // Which conditional fields appear comes from the client's matrix; this only
  // covers the blocks the matrix does not model (extra private features).
  const { isResidential } = getPropertyTypeFlags(form.tipo_propiedad);
  const showAmenities = isFieldVisible("amenities", form.tipo_propiedad);
  const hasSale =
    form.tipo_operacion === "VENTA" || form.tipo_operacion === "VENTA_RENTA";
  const hasRent =
    form.tipo_operacion === "RENTA" || form.tipo_operacion === "VENTA_RENTA";

  /** Per-field validation errors from the matrix, shown next to each control. */
  const [fieldErrors, setFieldErrors] = useState<PropertyFieldError[]>([]);
  const errorFor = (field: string) =>
    fieldErrors.find((e) => e.field === field)?.message;

  /* ---- Field helpers ---- */

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateMatrixField<K extends SectionFieldKey>(
    key: K,
    value: PropertyFieldValues[K]
  ) {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
    setFieldErrors((prev) => prev.filter((e) => e.field !== key));
  }

  /**
   * Changing the property type re-derives the visible fields AND drops the
   * values that stopped applying — a listing switched from Casa to Terreno
   * must not keep the recámaras and "Amueblado: Sí" captured for the house.
   */
  function handleTypeChange(nextType: string) {
    setForm((prev) => {
      const amenities = clearHiddenAmenities(
        nextType,
        prev.amenidades,
        prev.amenidades_confirmadas
      );
      return {
        ...prev,
        tipo_propiedad: nextType,
        fields: clearHiddenFieldValues(nextType, prev.fields),
        amenidades: amenities.amenities,
        amenidades_confirmadas: amenities.amenitiesAnswered,
      };
    });
    setFieldErrors([]);
  }

  /* ---- Location (SEPOMEX catalog) ---- */

  // Reported by <LocationPicker>: tells us whether the chosen
  // estado/municipio/colonia combination exists in the catalog.
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(
    INITIAL_LOCATION_STATUS
  );

  const locationValue: LocationValue = {
    estado: form.estado,
    ciudad: form.ciudad,
    colonia: form.colonia,
    codigo_postal: form.codigo_postal,
  };

  const handleLocationChange = useCallback((patch: Partial<LocationValue>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

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

      const remaining = MAX_PROPERTY_IMAGES - images.length;
      const toAdd = newFiles.slice(0, remaining);
      if (toAdd.length === 0) return;

      // Build previews preserving the EXACT order of `toAdd`. Using
      // Promise.all (instead of pushing inside each FileReader.onload) keeps
      // the order stable even if a reader finishes before another — otherwise
      // the photo shown as "Principal" could differ from the real cover.
      Promise.all(
        toAdd.map(
          (file) =>
            new Promise<NewImage>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) =>
                resolve({ file, preview: e.target?.result as string });
              reader.readAsDataURL(file);
            })
        )
      ).then((items) => {
        setImages((prev) => [...prev, ...items]);
      });
    },
    [images.length]
  );

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  const photoItems: PhotoItem[] = images.map((img, idx) => ({
    key: `${idx}-${img.preview.slice(-24)}`,
    src: img.preview,
  }));

  /* ---- Upload images to Supabase Storage ---- */

  /**
   * Uploads the photos, stamping the watermark when one is configured.
   *
   * The pristine file is ALWAYS archived under `originals/` first. Without it
   * a stamped photo can never be re-stamped with a different watermark — the
   * mark is baked into the JPEG and the source is gone — which is exactly why
   * "aplicar a existentes" could not touch older listings.
   */
  async function uploadImages(propertyId: string): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];

    const wmActive = isWatermarkActive(watermark);
    const signature = watermarkSignature(watermark);
    const userId = user?.id ?? "";

    for (let i = 0; i < images.length; i++) {
      const original = images[i]!.file;
      const photoKey = newPhotoKey();

      // Archive the untouched source. Non-fatal: a failure here must not stop
      // the listing from being published, it only costs re-markability.
      const { error: origError } = await supabase.storage
        .from(WM_BUCKET)
        .upload(originalStoragePath(userId, propertyId, photoKey), original, {
          cacheControl: "3600",
          upsert: true,
          contentType: original.type || "image/jpeg",
        });
      if (origError) {
        logError("no se pudo archivar el original de la foto", origError);
      }

      const stamped = wmActive
        ? await applyWatermarkDetailed(original, watermark)
        : null;
      if (stamped?.error) {
        logError("watermark stamping failed on upload", stamped.error);
      }

      const useWm = !!stamped?.watermarked;
      const file: Blob = useWm ? stamped!.blob : original;
      const ext = useWm ? "jpg" : (original.name.split(".").pop() ?? "jpg");
      const path = useWm
        ? watermarkStoragePath(userId, propertyId, photoKey, signature)
        : `${userId}/${propertyId}/${photoKey}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(WM_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: useWm ? "image/jpeg" : original.type,
        });

      if (uploadError) {
        throw new Error(`Error subiendo imagen ${i + 1}: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(WM_BUCKET).getPublicUrl(path);

      urls.push(publicUrl);
    }

    return urls;
  }

  /* ---- Validate ---- */

  /**
   * Validates the whole form. Per-type rules come from the client's matrix
   * (PROPERTY_FIELD_MATRIX) so alta, edición and the API cannot disagree.
   */
  function validate(): { message: string | null; focused: boolean } {
    // Saving mid-upload would persist a media row whose URL is still empty.
    if (hasPendingVideoUploads(videos)) {
      return {
        message: "Espera a que termine de subirse el video antes de guardar.",
        focused: false,
      };
    }
    if (!form.titulo.trim()) return { message: "El título es obligatorio.", focused: false };
    if (!form.tipo_propiedad)
      return { message: "Selecciona el tipo de inmueble.", focused: false };
    if (!form.tipo_operacion)
      return { message: "Selecciona el tipo de operación.", focused: false };
    if (!form.descripcion.trim())
      return { message: "La descripción es obligatoria.", focused: false };

    if (hasSale && (!form.precio_venta || Number(form.precio_venta) <= 0)) {
      return { message: "Ingresa un precio de venta válido.", focused: false };
    }
    if (hasRent && (!form.precio_renta || Number(form.precio_renta) <= 0)) {
      return { message: "Ingresa un precio de renta válido.", focused: false };
    }

    // The matrix only knows "there must be a price"; the operation decides
    // which bucket holds it, so feed it the amount that applies.
    const matrixErrors = validatePropertyFieldValues(
      form.tipo_propiedad,
      form.fields,
      {
        price: hasSale ? form.precio_venta : form.precio_renta,
        currency: form.moneda,
        amenities: form.amenidades,
        amenitiesAnswered: form.amenidades_confirmadas,
      }
    );
    // price/currency are captured by the "Precio" card, already checked above.
    const conditional = matrixErrors.filter(
      (e) => e.field !== "price" && e.field !== "currency"
    );
    setFieldErrors(conditional);
    if (conditional.length > 0) {
      focusFirstInvalidField(conditional);
      return { message: conditional[0]!.message, focused: true };
    }

    // Location must exist in the SEPOMEX catalog (estado -> municipio ->
    // colonia), with free text allowed only for an explicit "Otra" colonia.
    const locationError = validateLocation(locationValue, locationStatus);
    if (locationError) return { message: locationError, focused: false };

    return { message: null, focused: false };
  }

  /* ---- Submit ---- */

  async function handleSubmit(status: "borrador" | "publicado") {
    setError(null);
    setSuccess(null);

    const { message: validationError, focused } = validate();
    if (validationError) {
      setError(validationError);
      // When the matrix already moved focus to the offending control, jumping
      // back to the top would undo it.
      if (!focused) window.scrollTo({ top: 0, behavior: "smooth" });
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

      const price_sale = hasSale ? asNum(form.precio_venta) : null;
      const price_rent = hasRent ? asNum(form.precio_renta) : null;
      // Legacy `price` column is NOT NULL in older rows but we made it
      // nullable in v2; we still fall back to whichever is set so legacy
      // listings keep displaying a single price.
      const legacyPrice = price_sale ?? price_rent;

      const { data: property, error: insertError } = await supabase
        .from("properties")
        .insert({
          owner_id: user.id,
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
          // Every conditional column at once, with the ones the matrix hides
          // for this type written as explicit nulls.
          ...propertyFieldValuesToDb(form.tipo_propiedad, form.fields),
          has_service_room: form.has_service_room,
          has_storage: form.has_storage,
          has_laundry_room: form.has_laundry_room,
          has_integrated_kitchen: form.has_integrated_kitchen,
          address_line: form.direccion || null,
          neighborhood: form.colonia || null,
          city: form.ciudad,
          state: form.estado,
          zip_code: form.codigo_postal || null,
          latitude,
          longitude,
          show_address: form.show_address,
          amenities: form.amenidades,
          amenities_answered: form.amenidades_confirmadas,
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

      // Video rows share `property_media`, so their sort_order continues after
      // the photos and the ficha can keep reading one ordered set.
      if (property) {
        const videoInserts = videos
          .filter((video) => video.status === "ready" && video.url)
          .map((video, idx) => ({
            property_id: property.id,
            url: video.url,
            media_type: "VIDEO",
            provider: video.provider,
            external_id: video.externalId,
            thumbnail_url: video.thumbnailUrl,
            alt_text: video.title,
            sort_order: images.length + idx,
            is_primary: idx === 0,
          }));

        if (videoInserts.length > 0) {
          const { error: videoError } = await supabase
            .from("property_media")
            .insert(videoInserts);

          if (videoError) logError("Error saving video media:", videoError);
        }
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
          Publicar Propiedad
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Completa la información de tu propiedad para publicarla en Bithauss.
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

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-gray-700">
                Tipo de inmueble <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.tipo_propiedad}
                onValueChange={handleTypeChange}
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

      {/* ============================================================ */}
      {/*  Precio                                                       */}
      {/* ============================================================ */}
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

      {/* ============================================================ */}
      {/*  Características — derivadas de la matriz del cliente          */}
      {/* ============================================================ */}
      {form.tipo_propiedad && (
        <SectionCard
          title="Características"
          subtitle="Los campos cambian según el tipo de inmueble. Los marcados con * son obligatorios."
        >
          <PropertyFieldsSection
            type={form.tipo_propiedad}
            values={form.fields}
            onChange={updateMatrixField}
            errors={fieldErrors}
          />
        </SectionCard>
      )}

      {/* ============================================================ */}
      {/*  Características del inmueble (private features, residential) */}
      {/* ============================================================ */}
      {isResidential && (
        <SectionCard
          title="Características del inmueble"
          subtitle="Espacios privados del inmueble (no son áreas comunes del edificio)."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      {/* ============================================================ */}
      {/*  Ubicación                                                    */}
      {/* ============================================================ */}
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

          <LocationPicker
            value={locationValue}
            onChange={handleLocationChange}
            onStatusChange={setLocationStatus}
            idPrefix="nueva"
          />

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

      {/* ============================================================ */}
      {/*  Amenidades / Áreas comunes                                   */}
      {/*  Conditional: the matrix only asks for amenities on the       */}
      {/*  residential types.                                           */}
      {/* ============================================================ */}
      {showAmenities && (
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

        <AmenitiesAnsweredField
          answered={form.amenidades_confirmadas}
          onChange={(v) => {
            updateField("amenidades_confirmadas", v);
            setFieldErrors((prev) => prev.filter((e) => e.field !== "amenities"));
          }}
          selectedCount={form.amenidades.length}
          required={isFieldRequired("amenities", form.tipo_propiedad)}
          error={errorFor("amenities")}
        />
      </SectionCard>
      )}

      {/* ============================================================ */}
      {/*  Imágenes                                                     */}
      {/* ============================================================ */}
      <SectionCard title="Imágenes">
        <PhotoManager
          items={photoItems}
          onAdd={addImages}
          onRemove={removeImage}
          onMove={(from, to) => setImages((prev) => moveItem(prev, from, to))}
          onSetPrincipal={(idx) =>
            setImages((prev) => promoteToFront(prev, idx))
          }
        />
      </SectionCard>

      {/* ============================================================ */}
      {/*  Video                                                        */}
      {/*  Not a per-type matrix field: its state lives outside         */}
      {/*  `form.fields` on purpose.                                    */}
      {/* ============================================================ */}
      <SectionCard
        title="Video"
        subtitle="Opcional. Sube el recorrido de la propiedad o pega la liga de YouTube o Vimeo."
      >
        <VideoManager
          items={videos}
          onChange={setVideos}
          startUpload={user?.id ? startVideoUpload : undefined}
        />
      </SectionCard>

      {/* Action Buttons */}
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
            background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
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
