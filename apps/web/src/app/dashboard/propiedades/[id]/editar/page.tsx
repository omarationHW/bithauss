"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Clock,
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
import { isLegacyPropertyOperation } from "@bithauss/validators";
import { splitPropertyMedia } from "@/lib/property-video";
import { useUser } from "../../../_context/user-context";
import {
  PropertyFieldsSection,
  AmenitiesAnsweredField,
  EMPTY_PROPERTY_FIELD_VALUES,
  clearHiddenFieldValues,
  clearHiddenAmenities,
  validatePropertyFieldValues,
  propertyFieldValuesToDb,
  propertyFieldValuesFromDb,
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
import { ShieldBrc } from "@/components/ui/shield-brc";
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
 * TRASPASO is no longer offered — it became the matrix row "¿Aplica traspaso?"
 * on Local Comercial. Listings published before the change still carry it, so
 * the editor appends a read-only entry for the legacy value (see
 * `operationOptions` below) instead of blanking the select and losing what the
 * listing actually is.
 */
const OPERATION_TYPES = [
  { value: "VENTA", label: "Venta" },
  { value: "RENTA", label: "Renta" },
  { value: "VENTA_RENTA", label: "Venta y Renta" },
] as const;

const LEGACY_OPERATION_LABELS: Record<string, string> = {
  TRASPASO: "Traspaso (histórico)",
};

/** Matrix row "Moneda: Pesos / USD" — EUR was never accepted by the validator. */
const CURRENCIES = ["MXN", "USD"] as const;
const CRYPTOS = [
  { id: "BTC", label: "Bitcoin (BTC)" },
  { id: "ETH", label: "Ethereum (ETH)" },
  { id: "USDC", label: "USD Coin (USDC)" },
] as const;

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
 * "Terraza" moved into the matrix ("forzar a responder"), so it is rendered as
 * a Sí/No control by <PropertyFieldsSection>; two controls writing
 * `has_terrace` would fight each other.
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

/** A photo in the editor: either one already persisted in the DB
 *  ("existing") or a freshly added file pending upload ("new"). */
type EditImage =
  | { kind: "existing"; id: string; url: string }
  | { kind: "new"; file: File; preview: string };

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
  /** The conditional rows of the client's matrix. */
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

  const [form, setForm] = useState<FormData>(initialFormData);
  // Unified, ordered photo list — existing (already in DB) and newly added
  // files live in the SAME array so they can be freely reordered and any one
  // can be set as the cover. Index 0 is always the principal/cover photo.
  const [orderedImages, setOrderedImages] = useState<EditImage[]>([]);
  // Videos already saved plus the ones added in this session. Video is not a
  // per-type matrix field, so it stays out of `form.fields`.
  const [videos, setVideos] = useState<PropertyVideoDraft[]>([]);
  const [watermark, setWatermark] = useState<WatermarkConfig>(
    DEFAULT_WATERMARK_CONFIG
  );
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string>("");
  const [, setOriginalStatus] = useState<string>("");
  const [brcStatus, setBrcStatus] = useState<string>("NO_SOLICITADO");

  // Which conditional fields appear comes from the client's matrix; this only
  // covers the blocks the matrix does not model (extra private features).
  const { isResidential } = getPropertyTypeFlags(form.tipo_propiedad);
  const showAmenities = isFieldVisible("amenities", form.tipo_propiedad);
  const isLegacyOperation = isLegacyPropertyOperation(form.tipo_operacion);
  // A legacy TRASPASO listing is still a sale for pricing purposes, so its
  // amount keeps rendering while the owner picks a current operation.
  const hasSale =
    form.tipo_operacion === "VENTA" ||
    form.tipo_operacion === "VENTA_RENTA" ||
    isLegacyOperation;
  const hasRent =
    form.tipo_operacion === "RENTA" || form.tipo_operacion === "VENTA_RENTA";

  /**
   * Options for the operation select. Retired values are appended only when
   * the listing already carries one, so they can be READ but never chosen for
   * a listing that does not have one.
   */
  const operationOptions: { value: string; label: string }[] = [
    ...OPERATION_TYPES,
    ...(isLegacyOperation
      ? [
          {
            value: form.tipo_operacion,
            label:
              LEGACY_OPERATION_LABELS[form.tipo_operacion] ?? form.tipo_operacion,
          },
        ]
      : []),
  ];

  /**
   * The currency catalogue shrank to the matrix's "Pesos / USD". A listing
   * saved with an older option (EUR) keeps it as a selectable entry, so the
   * select never renders blank on a value the row actually holds.
   */
  const currencyOptions: string[] = (CURRENCIES as readonly string[]).includes(
    form.moneda
  )
    ? [...CURRENCIES]
    : [...CURRENCIES, form.moneda].filter(Boolean);

  /** Per-field validation errors from the matrix. */
  const [fieldErrors, setFieldErrors] = useState<PropertyFieldError[]>([]);
  const errorFor = (field: string) =>
    fieldErrors.find((e) => e.field === field)?.message;

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
      // A retired TRASPASO listing was priced like a sale, so its amount
      // belongs in the sale bucket — the operation itself is no longer
      // selectable, but its price must still be visible.
      const legacyPrice = property.price != null ? String(property.price) : "";
      const priceSaleStr =
        property.price_sale != null
          ? String(property.price_sale)
          : op === "VENTA" || isLegacyPropertyOperation(op)
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
        fields: propertyFieldValuesFromDb(property),
        has_service_room: property.has_service_room ?? false,
        has_storage: property.has_storage ?? false,
        has_laundry_room: property.has_laundry_room ?? false,
        has_integrated_kitchen: property.has_integrated_kitchen ?? false,
        direccion: property.address_line ?? "",
        colonia: property.neighborhood ?? "",
        ciudad: property.city ?? "",
        estado: property.state ?? "",
        codigo_postal: property.zip_code ?? "",
        show_address: property.show_address ?? true,
        amenidades: Array.isArray(property.amenities) ? property.amenities : [],
        amenidades_confirmadas: property.amenities_answered === true,
      });

      // Photos and videos now share `property_media`, so the rows have to be
      // split by `media_type` — feeding a VIDEO row to the photo grid would
      // render an .mp4 inside <Image>.
      const { data: media } = await supabase
        .from("property_media")
        .select(
          "id, url, sort_order, media_type, provider, external_id, thumbnail_url, alt_text"
        )
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });

      if (media && media.length > 0) {
        const { images: imageRows, videos: videoRows } = splitPropertyMedia(media);

        if (imageRows.length > 0) {
          setOrderedImages(
            imageRows.map((m) => ({ kind: "existing", id: m.id, url: m.url }))
          );
        }

        setVideos(
          videoRows.map((m) => ({
            key: m.id,
            id: m.id,
            provider:
              (m.provider as PropertyVideoDraft["provider"]) ?? "UPLOAD",
            url: m.url,
            externalId: m.external_id ?? null,
            thumbnailUrl: m.thumbnail_url ?? null,
            title: m.alt_text ?? null,
            status: "ready" as const,
            progress: 100,
            error: null,
          }))
        );
      }

      setLoading(false);
    }

    fetchProperty();
  }, [propertyId]);

  // Load the user's watermark configuration for stamping newly added photos.
  useEffect(() => {
    loadWatermarkConfig().then(setWatermark);
  }, []);

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
   * values that stopped applying, so an edited listing cannot carry the
   * recámaras of the type it used to be.
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

  // Reported by <LocationPicker>: tells us whether the saved (or edited)
  // estado/municipio/colonia combination exists in the catalog. Legacy
  // listings with a place outside the catalog are flagged there.
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

      const remaining = MAX_PROPERTY_IMAGES - orderedImages.length;
      const toAdd = newFiles.slice(0, remaining);
      if (toAdd.length === 0) return;

      // Build the new entries preserving the exact order of `toAdd` (Promise.all
      // keeps array order regardless of which FileReader finishes first).
      Promise.all(
        toAdd.map(
          (file) =>
            new Promise<EditImage>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) =>
                resolve({
                  kind: "new",
                  file,
                  preview: e.target?.result as string,
                });
              reader.readAsDataURL(file);
            })
        )
      ).then((items) => {
        setOrderedImages((prev) => [...prev, ...items]);
      });
    },
    [orderedImages.length]
  );

  function removeImage(index: number) {
    setOrderedImages((prev) => prev.filter((_, i) => i !== index));
  }

  const photoItems: PhotoItem[] = orderedImages.map((img, idx) => ({
    key: img.kind === "existing" ? img.id : `new-${idx}-${img.preview.slice(-24)}`,
    src: img.kind === "existing" ? img.url : img.preview,
  }));

  /* ---- Upload new images to Supabase Storage ---- */

  /**
   * Uploads newly added photos, stamping the watermark when one is configured.
   *
   * The pristine file is ALWAYS archived under `originals/` first — a stamped
   * JPEG cannot be re-stamped with a different watermark once the source is
   * gone, which is what left older listings stuck with their original mark.
   */
  /** Videos upload straight into the property's own prefix. */
  const startVideoUpload = useCallback(
    (file: File, onProgress: (percent: number) => void, contentType?: string) =>
      uploadPropertyVideo({
        userId: user?.id ?? "",
        propertyKey: propertyId,
        file,
        onProgress,
        contentType,
      }),
    [propertyId, user?.id]
  );

  async function uploadFiles(propId: string, files: File[]): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];
    const wmActive = isWatermarkActive(watermark);
    const signature = watermarkSignature(watermark);
    const userId = user?.id ?? "";

    for (let i = 0; i < files.length; i++) {
      const original = files[i]!;
      const photoKey = newPhotoKey();

      // Non-fatal: failing to archive only costs re-markability later.
      const { error: origError } = await supabase.storage
        .from(WM_BUCKET)
        .upload(originalStoragePath(userId, propId, photoKey), original, {
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
        ? watermarkStoragePath(userId, propId, photoKey, signature)
        : `${userId}/${propId}/${photoKey}.${ext}`;

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
   * (PROPERTY_FIELD_MATRIX), shared with the alta form.
   */
  function validate(): { message: string | null; focused: boolean } {
    // Saving mid-upload would persist a media row whose URL is still empty.
    if (hasPendingVideoUploads(videos)) {
      return {
        message: "Espera a que termine de subirse el video antes de guardar.",
        focused: false,
      };
    }
    if (!form.titulo.trim())
      return { message: "El título es obligatorio.", focused: false };
    if (!form.tipo_propiedad)
      return { message: "Selecciona el tipo de inmueble.", focused: false };
    if (!form.tipo_operacion)
      return { message: "Selecciona el tipo de operación.", focused: false };
    // A retired operation can be displayed but not saved again: the owner has
    // to restate the listing as Venta o Renta (the traspaso itself is now the
    // "¿Aplica traspaso?" answer on Local Comercial).
    if (isLegacyOperation) {
      return {
        message:
          "La operación “Traspaso” ya no existe. Selecciona Venta o Renta; si es un traspaso de local, respóndelo en “¿Aplica traspaso?”.",
        focused: false,
      };
    }
    if (!form.descripcion.trim())
      return { message: "La descripción es obligatoria.", focused: false };

    if (hasSale && (!form.precio_venta || Number(form.precio_venta) <= 0)) {
      return { message: "Ingresa un precio de venta válido.", focused: false };
    }
    if (hasRent && (!form.precio_renta || Number(form.precio_renta) <= 0)) {
      return { message: "Ingresa un precio de renta válido.", focused: false };
    }

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
        // Every conditional column at once, with the ones the matrix hides for
        // this type written as explicit nulls — an update that omitted them
        // would keep the previous type's values.
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
        show_address: form.show_address,
        amenities: form.amenidades,
        amenities_answered: form.amenidades_confirmadas,
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

      // Media: upload any newly added files (in their displayed order), then
      // rewrite the whole property_media set so sort_order matches the exact
      // order shown in the editor. Index 0 is the principal/cover photo.
      const newFiles = orderedImages
        .filter((img): img is Extract<EditImage, { kind: "new" }> => img.kind === "new")
        .map((img) => img.file);

      const uploadedUrls =
        newFiles.length > 0 ? await uploadFiles(propertyId, newFiles) : [];

      let uploadCursor = 0;
      const finalUrls = orderedImages.map((img) =>
        img.kind === "existing" ? img.url : uploadedUrls[uploadCursor++]!
      );

      // Replace the PHOTO rows with the new ordered set. The delete is scoped
      // to media_type = 'IMAGE' on purpose: an unscoped delete would also wipe
      // the property's videos, which this block knows nothing about.
      await supabase
        .from("property_media")
        .delete()
        .eq("property_id", propertyId)
        .eq("media_type", "IMAGE");

      if (finalUrls.length > 0) {
        // No `is_primary` here on purpose: the cover photo is index 0 by
        // convention (as before), so the photo path keeps working even on an
        // environment where migración 030 has not run yet.
        const mediaInserts = finalUrls.map((url, idx) => ({
          property_id: propertyId,
          url,
          media_type: "IMAGE",
          sort_order: idx,
        }));

        const { error: mediaError } = await supabase
          .from("property_media")
          .insert(mediaInserts);

        if (mediaError) logError("Error saving media:", mediaError);
      }

      // Same strategy for videos: rewrite the whole VIDEO set so sort_order
      // matches the order shown in the editor and removals actually stick.
      await supabase
        .from("property_media")
        .delete()
        .eq("property_id", propertyId)
        .eq("media_type", "VIDEO");

      const videoInserts = videos
        .filter((video) => video.status === "ready" && video.url)
        .map((video, idx) => ({
          property_id: propertyId,
          url: video.url,
          media_type: "VIDEO",
          provider: video.provider,
          external_id: video.externalId,
          thumbnail_url: video.thumbnailUrl,
          alt_text: video.title,
          sort_order: finalUrls.length + idx,
          is_primary: idx === 0,
        }));

      if (videoInserts.length > 0) {
        const { error: videoError } = await supabase
          .from("property_media")
          .insert(videoInserts);

        if (videoError) logError("Error saving video media:", videoError);
      }

      // Keep featured_image_url (used by listing cards) in sync with the cover
      // photo (index 0), so cards and the detail page show the same principal.
      await supabase
        .from("properties")
        .update({ featured_image_url: finalUrls[0] ?? null })
        .eq("id", propertyId);

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
                  {operationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLegacyOperation && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Esta propiedad se publicó como traspaso, una operación que ya
                  no existe. Selecciona Venta o Renta para poder guardar; si es
                  el traspaso de un local, respóndelo en “¿Aplica traspaso?”.
                </p>
              )}
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
                  {currencyOptions.map((c) => (
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

      {/* Características — derivadas de la matriz del cliente */}
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

      {/* Características del inmueble (private features) */}
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

          <LocationPicker
            value={locationValue}
            onChange={handleLocationChange}
            onStatusChange={setLocationStatus}
            idPrefix="editar"
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

      {/* Amenidades / Áreas comunes — la matriz sólo las pide en los tipos
          residenciales. */}
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

      {/* Imágenes */}
      <SectionCard title="Imágenes">
        <PhotoManager
          items={photoItems}
          onAdd={addImages}
          onRemove={removeImage}
          onMove={(from, to) =>
            setOrderedImages((prev) => moveItem(prev, from, to))
          }
          onSetPrincipal={(idx) =>
            setOrderedImages((prev) => promoteToFront(prev, idx))
          }
        />
      </SectionCard>

      {/* ============================================================ */}
      {/*  Video — no es un campo por tipo, vive fuera de form.fields    */}
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
