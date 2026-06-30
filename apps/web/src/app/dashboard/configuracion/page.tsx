"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { useUser } from "../_context/user-context";
import {
  Bell,
  Shield,
  AlertTriangle,
  Key,
  ArrowLeft,
  Trash2,
  Stamp,
  Upload,
  Loader2,
  User as UserIcon,
  Image as ImageIcon,
} from "lucide-react";
import {
  DEFAULT_WATERMARK_CONFIG,
  isWatermarked,
  applyWatermark,
  WM_SUFFIX,
  type WatermarkConfig,
  type WatermarkPosition,
} from "@/lib/watermark";

/* ------------------------------------------------------------------ */
/*  Toggle Component                                                   */
/* ------------------------------------------------------------------ */

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 focus:outline-none ${
        enabled ? "" : "bg-gray-200"
      }`}
      style={
        enabled
          ? {
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }
          : undefined
      }
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-300 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}


const WM_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "TOP_LEFT", label: "Sup. izq." },
  { value: "TOP_RIGHT", label: "Sup. der." },
  { value: "CENTER", label: "Centro" },
  { value: "BOTTOM_LEFT", label: "Inf. izq." },
  { value: "BOTTOM_RIGHT", label: "Inf. der." },
  { value: "TILE", label: "Mosaico" },
];

/** Tailwind anchor classes used in the live preview. */
function previewAnchor(pos: WatermarkPosition): string {
  switch (pos) {
    case "TOP_LEFT":
      return "top-2 left-2";
    case "TOP_RIGHT":
      return "top-2 right-2";
    case "BOTTOM_LEFT":
      return "bottom-2 left-2";
    case "CENTER":
    case "TILE":
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "BOTTOM_RIGHT":
    default:
      return "bottom-2 right-2";
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ConfiguracionPage() {
  const { user, logout } = useUser();
  const [, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notifications, setNotifications] = useState({
    leads: true,
    brcUpdates: true,
    messages: true,
    marketing: false,
  });

  /* ---- Watermark ---- */
  const [watermark, setWatermark] = useState<WatermarkConfig>(
    DEFAULT_WATERMARK_CONFIG
  );
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load saved preferences
  useEffect(() => {
    async function loadPrefs() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.user_metadata?.preferences) {
        const prefs = authUser.user_metadata.preferences;
        if (prefs.notifications) setNotifications(prefs.notifications);
        if (prefs.watermark)
          setWatermark({ ...DEFAULT_WATERMARK_CONFIG, ...prefs.watermark });
      }
    }
    loadPrefs();
  }, []);

  // Persist the FULL preferences object so notifications and watermark never
  // clobber each other (auth.updateUser replaces the whole `preferences` key).
  const persistPrefs = useCallback(
    async (notif: typeof notifications, wm: WatermarkConfig) => {
      setSaving(true);
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { preferences: { notifications: notif, watermark: wm } },
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    []
  );

  function toggleNotification(key: keyof typeof notifications) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    persistPrefs(updated, watermark);
  }

  function updateWatermark(patch: Partial<WatermarkConfig>) {
    const next = { ...watermark, ...patch };
    setWatermark(next);
    persistPrefs(notifications, next);
  }

  // Upload a dedicated watermark logo (stored in the public "avatars" bucket).
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/watermark-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      updateWatermark({ source: "CUSTOM", url: publicUrl });
    } catch (err) {
      logError("Error uploading watermark logo:", err);
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function handleUseAvatar() {
    if (!user?.avatarUrl) {
      setReprocessMsg(
        "No tienes foto de perfil. Súbela en tu Perfil o usa un logo."
      );
      return;
    }
    updateWatermark({ source: "AVATAR", url: user.avatarUrl });
  }

  // Re-stamp every existing photo of the user that isn't watermarked yet.
  async function handleReprocessExisting() {
    if (!user || !watermark.url) return;
    setReprocessing(true);
    setReprocessMsg("Buscando fotos…");
    try {
      const supabase = createClient();
      const { data: props } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", user.id);
      const propIds = (props ?? []).map((p) => p.id as string);
      if (propIds.length === 0) {
        setReprocessMsg("No tienes propiedades con fotos.");
        setReprocessing(false);
        return;
      }

      const { data: media } = await supabase
        .from("property_media")
        .select("id, property_id, url, sort_order")
        .in("property_id", propIds);

      const pending = (media ?? []).filter(
        (m) => !isWatermarked(m.url as string)
      );
      if (pending.length === 0) {
        setReprocessMsg("Todas tus fotos ya tienen marca de agua. ✓");
        setReprocessing(false);
        return;
      }

      let done = 0;
      const touchedProps = new Set<string>();
      for (const m of pending) {
        try {
          setReprocessMsg(`Procesando ${done + 1} de ${pending.length}…`);
          // Fetch through our same-origin proxy so cross-origin images
          // (e.g. the Azure CDN photos) can be read into the canvas.
          const resp = await fetch(
            `/api/proxy-image?url=${encodeURIComponent(m.url as string)}`
          );
          if (!resp.ok) throw new Error(`proxy ${resp.status}`);
          const blob = await resp.blob();
          const stamped = await applyWatermark(blob, watermark);
          const path = `${user.id}/${m.property_id}/reproc-${Date.now()}-${(
            m.id as string
          ).slice(0, 8)}${WM_SUFFIX}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("properties")
            .upload(path, stamped, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            });
          if (upErr) throw upErr;
          const {
            data: { publicUrl },
          } = supabase.storage.from("properties").getPublicUrl(path);
          await supabase
            .from("property_media")
            .update({ url: publicUrl })
            .eq("id", m.id as string);
          touchedProps.add(m.property_id as string);
          done++;
        } catch (err) {
          logError("Error reprocessing media", err);
        }
      }

      // Refresh featured_image_url for each touched property (cover = sort_order 0).
      for (const pid of touchedProps) {
        const { data: cover } = await supabase
          .from("property_media")
          .select("url")
          .eq("property_id", pid)
          .order("sort_order", { ascending: true })
          .limit(1);
        if (cover?.[0]?.url) {
          await supabase
            .from("properties")
            .update({ featured_image_url: cover[0].url })
            .eq("id", pid);
        }
      }

      setReprocessMsg(`Listo: ${done} foto(s) con marca de agua. ✓`);
    } catch (err) {
      logError("Error reprocessing existing photos", err);
      setReprocessMsg("Ocurrió un error al reprocesar las fotos.");
    }
    setReprocessing(false);
  }


  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar tu cuenta? Esta acción eliminará permanentemente tu cuenta, propiedades, leads y todos los datos asociados. Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    const confirmText = window.prompt(
      'Escribe "ELIMINAR" para confirmar la eliminación de tu cuenta:'
    );
    if (confirmText !== "ELIMINAR") return;

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
        await fetch(`${apiBase}/api/v1/profiles/me`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }

      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      await logout();
    }
  }

  async function handleChangePassword() {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser?.email) {
      await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      alert("Se ha enviado un enlace para cambiar tu contraseña a tu correo electrónico.");
    }
  }

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <div>
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Dashboard
        </Link>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Configuracion
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Administra tus preferencias y configuración de cuenta.
        </p>
        {saved && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 animate-fade-in-up">
            ✓ Guardado
          </span>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Marca de agua                                               */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
              }}
            >
              <Stamp className="h-5 w-5" style={{ color: "hsl(221 83% 53%)" }} />
            </div>
            <div>
              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Marca de agua
              </h3>
              <p className="text-sm text-gray-500">
                Protege tus fotos incrustando tu logo o foto de perfil.
              </p>
            </div>
          </div>
          <Toggle
            enabled={watermark.enabled}
            onToggle={() => updateWatermark({ enabled: !watermark.enabled })}
          />
        </div>

        {watermark.enabled && (
          <div className="space-y-6 px-6 py-5">
            {/* Source selector */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">
                Imagen de la marca
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                    watermark.source === "CUSTOM"
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Subir logo
                </button>
                <button
                  type="button"
                  onClick={handleUseAvatar}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                    watermark.source === "AVATAR"
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <UserIcon className="h-4 w-4" />
                  Usar foto de perfil
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-gray-400">
                Para mejor resultado, usa un PNG con fondo transparente.
              </p>
            </div>

            {/* Position + sliders + preview */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                {/* Position */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Posición</p>
                  <div className="grid grid-cols-3 gap-2">
                    {WM_POSITIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => updateWatermark({ position: p.value })}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                          watermark.position === p.value
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      Opacidad
                    </p>
                    <span className="text-xs text-gray-500">
                      {Math.round(watermark.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={Math.round(watermark.opacity * 100)}
                    onChange={(e) =>
                      updateWatermark({ opacity: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Scale */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Tamaño</p>
                    <span className="text-xs text-gray-500">
                      {Math.round(watermark.scale * 100)}% del ancho
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={45}
                    value={Math.round(watermark.scale * 100)}
                    onChange={(e) =>
                      updateWatermark({ scale: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Vista previa</p>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg"
                    alt="Muestra"
                    className="h-full w-full object-cover"
                  />
                  {watermark.url ? (
                    watermark.position === "TILE" ? (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          opacity: watermark.opacity,
                          backgroundImage: `url(${watermark.url})`,
                          backgroundRepeat: "repeat",
                          backgroundSize: `${watermark.scale * 100}%`,
                        }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={watermark.url}
                        alt="Marca de agua"
                        className={`pointer-events-none absolute ${previewAnchor(
                          watermark.position
                        )}`}
                        style={{
                          width: `${watermark.scale * 100}%`,
                          opacity: watermark.opacity,
                        }}
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-center text-xs font-medium text-white">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4" />
                        Elige un logo o tu foto de perfil
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reprocess existing */}
            <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Aplicar a fotos existentes
                </p>
                <p className="text-xs text-gray-500">
                  Vuelve a procesar tus fotos ya publicadas para añadirles la
                  marca de agua.
                </p>
                {reprocessMsg && (
                  <p className="mt-1 text-xs font-medium text-blue-600">
                    {reprocessMsg}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleReprocessExisting}
                disabled={reprocessing || !watermark.url}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {reprocessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Stamp className="h-4 w-4" />
                )}
                {reprocessing ? "Procesando…" : "Aplicar a existentes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Notificaciones                                              */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
            }}
          >
            <Bell
              className="h-5 w-5"
              style={{ color: "hsl(221 83% 53%)" }}
            />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Notificaciones
            </h3>
            <p className="text-sm text-gray-500">
              Controla que notificaciones recibes por email.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {[
            {
              key: "leads" as const,
              label: "Nuevos Leads",
              description:
                "Recibe un email cuando un lead se interese en tu propiedad.",
            },
            {
              key: "brcUpdates" as const,
              label: "Actualizaciones BRC",
              description:
                "Notificaciones sobre el estado de tus expedientes BRC.",
            },
            {
              key: "messages" as const,
              label: "Mensajes",
              description:
                "Recibe notificaciones cuando te envien un mensaje directo.",
            },
            {
              key: "marketing" as const,
              label: "Promociones y Marketing",
              description:
                "Ofertas especiales, novedades y consejos para brokers.",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {item.description}
                </p>
              </div>
              <Toggle
                enabled={notifications[item.key]}
                onToggle={() => toggleNotification(item.key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Seguridad                                                   */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
            }}
          >
            <Shield
              className="h-5 w-5"
              style={{ color: "hsl(221 83% 53%)" }}
            />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Seguridad
            </h3>
            <p className="text-sm text-gray-500">
              Protege tu cuenta con opciones de seguridad avanzadas.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Change password */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Cambiar Contrasena
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Actualiza tu contrasena de acceso.
                </p>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
            >
              Cambiar
            </button>
          </div>


        </div>
      </div>

      {/* ============================================================ */}
      {/*  Zona de Peligro                                             */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-red-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-red-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Zona de Peligro
            </h3>
            <p className="text-sm text-red-500">
              Acciones irreversibles en tu cuenta.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Eliminar Cuenta
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              Esta accion eliminara permanentemente tu cuenta, propiedades, leads
              y todos los datos asociados. Esta accion no se puede deshacer.
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-red-700 hover:shadow-lg"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar Cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
