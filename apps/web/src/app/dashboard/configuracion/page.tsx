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
  applyWatermarkDetailed,
  broadcastWatermarkConfigChange,
  clearWatermarkImageCache,
  fetchImageAsBlob,
  isGeneratedWatermarkPath,
  isWatermarked,
  newPhotoKey,
  normalizeWatermarkConfig,
  originalStoragePath,
  ORIGINALS_DIR,
  photoKeyFromWatermarkPath,
  storagePathFromPublicUrl,
  watermarkSignature,
  watermarkStoragePath,
  withCacheBust,
  WM_BUCKET,
  WM_MARGIN_RATIO,
  TILE_STEP_X,
  TILE_STEP_Y,
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

/**
 * Live preview geometry.
 *
 * The preview box is a fixed 4:3 frame, while the canvas works in the photo's
 * own pixels. Margins/sizes in `lib/watermark.ts` are expressed as fractions of
 * the photo WIDTH, so the vertical ones have to be re-scaled by the aspect
 * ratio here — otherwise the preview does not match the exported image.
 */
const PREVIEW_ASPECT = 4 / 3;
const MARGIN_X_PCT = WM_MARGIN_RATIO * 100;
const MARGIN_Y_PCT = WM_MARGIN_RATIO * PREVIEW_ASPECT * 100;

/** Absolute-position style that mirrors `cornerPosition()` in the canvas. */
function previewAnchorStyle(pos: WatermarkPosition): React.CSSProperties {
  switch (pos) {
    case "TOP_LEFT":
      return { top: `${MARGIN_Y_PCT}%`, left: `${MARGIN_X_PCT}%` };
    case "TOP_RIGHT":
      return { top: `${MARGIN_Y_PCT}%`, right: `${MARGIN_X_PCT}%` };
    case "BOTTOM_LEFT":
      return { bottom: `${MARGIN_Y_PCT}%`, left: `${MARGIN_X_PCT}%` };
    case "CENTER":
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "BOTTOM_RIGHT":
    default:
      return { bottom: `${MARGIN_Y_PCT}%`, right: `${MARGIN_X_PCT}%` };
  }
}

/**
 * Tile origins (as 0..1 fractions of the preview box) replicating the nested
 * loop used by the canvas renderer. `logoAspect` is the measured natural
 * width/height of the watermark image.
 */
function previewTileOrigins(
  scale: number,
  logoAspect: number
): { x: number; y: number }[] {
  const wFrac = scale;
  const hFrac = (scale * PREVIEW_ASPECT) / (logoAspect || 1);
  const stepX = Math.max(wFrac * TILE_STEP_X, 0.02);
  const stepY = Math.max(hFrac * TILE_STEP_Y, 0.02);
  const origins: { x: number; y: number }[] = [];
  for (let y = WM_MARGIN_RATIO * PREVIEW_ASPECT; y < 1; y += stepY) {
    for (let x = WM_MARGIN_RATIO; x < 1; x += stepX) {
      origins.push({ x, y });
      if (origins.length > 400) return origins;
    }
  }
  return origins;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type NotificationPrefs = {
  leads: boolean;
  brcUpdates: boolean;
  messages: boolean;
  marketing: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ConfiguracionPage() {
  const { user, logout } = useUser();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationPrefs>({
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
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoAspect, setLogoAspect] = useState(1);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
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
          setWatermark(normalizeWatermarkConfig(prefs.watermark));
      }
    }
    loadPrefs();
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Persistence                                                        */
  /* ------------------------------------------------------------------ */
  /*
   * `supabase.auth.updateUser` is a network PUT serialized behind the auth
   * lock. Firing it on every `onChange` of a range input queued dozens of
   * writes per drag: the UI reported "Guardado" after the first one while the
   * rest were still in flight, and leaving the page mid-queue persisted an
   * INTERMEDIATE value — the classic "no se actualiza la marca de agua".
   *
   * Writes are therefore coalesced (last value wins) and never overlap, the
   * returned error is surfaced instead of ignored, and a broadcast tells the
   * other screens to re-read the config.
   */
  const pendingRef = useRef<{
    notif: NotificationPrefs;
    wm: WatermarkConfig;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runFlush = useCallback(async (): Promise<boolean> => {
    const supabase = createClient();
    let ok = true;
    // Drain the queue: a change made while a write is in flight is picked up by
    // the next iteration, so the last value the user chose always wins.
    while (pendingRef.current) {
      const { notif, wm } = pendingRef.current;
      pendingRef.current = null;
      setSaveState("saving");
      setSaveError(null);
      const stamped: WatermarkConfig = { ...wm, updatedAt: Date.now() };
      const { error } = await supabase.auth.updateUser({
        data: { preferences: { notifications: notif, watermark: stamped } },
      });
      if (error) {
        ok = false;
        logError("Error saving preferences", error);
        setSaveState("error");
        setSaveError(
          error.message ||
            "No se pudieron guardar los cambios. Revisa tu conexión."
        );
        break;
      }
      // Screens mounted before this change re-read the config instead of
      // keeping the copy they loaded on mount.
      broadcastWatermarkConfigChange(stamped);
    }
    if (ok) {
      setSaveState("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500);
    }
    return ok;
  }, []);

  /** Persist everything pending right now; resolves to false on failure. */
  const flushPrefs = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const running = inFlightRef.current;
    if (running) {
      const prev = await running;
      if (!pendingRef.current) return prev;
    }
    if (!pendingRef.current) return true;
    const p = runFlush();
    inFlightRef.current = p;
    void p.finally(() => {
      if (inFlightRef.current === p) inFlightRef.current = null;
    });
    return p;
  }, [runFlush]);

  const persistPrefs = useCallback(
    (notif: NotificationPrefs, wm: WatermarkConfig, immediate = true) => {
      pendingRef.current = { notif, wm };
      setSaveState("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      if (immediate) {
        void flushPrefs();
      } else {
        // Sliders: coalesce the whole drag into a single write.
        timerRef.current = setTimeout(() => void flushPrefs(), 500);
      }
    },
    [flushPrefs]
  );

  // Never lose the last slider value when the user navigates away mid-debounce.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (pendingRef.current) void flushPrefs();
    };
  }, [flushPrefs]);

  function toggleNotification(key: keyof NotificationPrefs) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    persistPrefs(updated, watermark);
  }

  function updateWatermark(patch: Partial<WatermarkConfig>, immediate = true) {
    const next = normalizeWatermarkConfig({ ...watermark, ...patch });
    setWatermark(next);
    persistPrefs(notifications, next, immediate);
  }

  // Upload a dedicated watermark logo (stored in the public "avatars" bucket).
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/watermark-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      clearWatermarkImageCache();
      updateWatermark({ source: "CUSTOM", url: publicUrl });
    } catch (err) {
      logError("Error uploading watermark logo:", err);
      setLogoError(
        err instanceof Error
          ? `No se pudo subir el logo: ${err.message}`
          : "No se pudo subir el logo."
      );
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function handleUseAvatar() {
    if (!user?.avatarUrl) {
      setLogoError(
        "No tienes foto de perfil. Súbela en tu Perfil o usa un logo."
      );
      return;
    }
    setLogoError(null);
    clearWatermarkImageCache();
    updateWatermark({ source: "AVATAR", url: user.avatarUrl });
  }

  /** Measure the logo so the TILE preview can reproduce the canvas spacing. */
  function handleLogoMeasured(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setLogoAspect((prev) => (Math.abs(prev - ratio) < 0.001 ? prev : ratio));
    }
  }

  /**
   * (Re-)stamp every existing photo with the CURRENT configuration.
   *
   * Unlike the previous implementation this also updates photos that already
   * carry a watermark — that is the whole point of changing the position /
   * opacity / size / logo. A baked-in watermark cannot be undone, so the
   * pristine bytes are archived once, the first time we touch a photo, under
   * `<uid>/<pid>/originals/<mediaId>.orig`, and every later run re-derives the
   * stamped image from that archive instead of stacking marks on top of marks.
   *
   * LIMITATION: photos that were uploaded already stamped by the property form
   * (`nueva` / `editar` bake the watermark before upload and keep no original)
   * have no archived original. Those are skipped and reported rather than
   * double-stamped. To update them the user must re-upload the photo.
   */
  async function handleReprocessExisting() {
    if (!user) return;
    if (!watermark.enabled) {
      setReprocessError("Activa la marca de agua antes de aplicarla.");
      return;
    }
    if (!watermark.url) {
      setReprocessError(
        "Primero elige un logo o tu foto de perfil para la marca de agua."
      );
      return;
    }

    setReprocessing(true);
    setReprocessError(null);
    setReprocessMsg("Guardando configuración…");

    // Bake exactly what is on screen: make sure the pending (debounced) save
    // landed before generating images from it.
    const persisted = await flushPrefs();
    if (!persisted) {
      setReprocessError(
        "No se pudo guardar la configuración, por lo que no se reprocesaron las fotos."
      );
      setReprocessMsg(null);
      setReprocessing(false);
      return;
    }

    const supabase = createClient();
    const signature = watermarkSignature(watermark);

    try {
      setReprocessMsg("Buscando fotos…");
      // Deleted listings are soft-deleted (status = 'ELIMINADO') and keep their
      // property_media rows, so without this filter the run burned through
      // photos of listings the owner already removed — and then named those
      // dead listings in the "omitidas" report, which is just confusing.
      const { data: props, error: propsErr } = await supabase
        .from("properties")
        .select("id, title")
        .eq("owner_id", user.id)
        .neq("status", "ELIMINADO");
      if (propsErr) throw propsErr;

      const propIds = (props ?? []).map((p) => p.id as string);
      const titleById = new Map(
        (props ?? []).map((p) => [p.id as string, (p.title as string) || "Sin título"])
      );
      if (propIds.length === 0) {
        setReprocessMsg("No tienes propiedades con fotos.");
        setReprocessing(false);
        return;
      }

      // media_type = 'IMAGE' is NOT optional. Since migración 030 the same
      // table also holds VIDEO rows, and this routine downloads every `url`,
      // stamps it as a PNG and writes the result BACK to `property_media.url`:
      // without the filter it would overwrite a broker's video with a picture
      // (or, for a YouTube row, fail and report the listing as "con error").
      const { data: media, error: mediaErr } = await supabase
        .from("property_media")
        .select("id, property_id, url, sort_order")
        .eq("media_type", "IMAGE")
        .in("property_id", propIds)
        .order("sort_order", { ascending: true });
      if (mediaErr) throw mediaErr;

      const rows = (media ?? []) as {
        id: string;
        property_id: string;
        url: string;
      }[];
      if (rows.length === 0) {
        setReprocessMsg("No tienes fotos que procesar.");
        setReprocessing(false);
        return;
      }

      let done = 0;
      let skipped = 0;
      let failed = 0;
      let lastError: string | null = null;
      const touchedProps = new Set<string>();
      const skippedProps = new Set<string>();

      // Photos duplicated across rows must not have their shared source object
      // deleted after the first row is re-pointed.
      const urlUses = new Map<string, number>();
      for (const r of rows) urlUses.set(r.url, (urlUses.get(r.url) ?? 0) + 1);

      for (let i = 0; i < rows.length; i++) {
        const m = rows[i]!;
        setReprocessMsg(`Procesando ${i + 1} de ${rows.length}…`);
        try {
          const prevPath = storagePathFromPublicUrl(m.url, WM_BUCKET);
          const wasGenerated =
            !!prevPath && isGeneratedWatermarkPath(prevPath, user.id);
          // Reuse the key baked into a previous render so the archived original
          // keeps matching this photo even after the editor re-created its row.
          const photoKey =
            (wasGenerated && prevPath
              ? photoKeyFromWatermarkPath(prevPath)
              : null) ?? newPhotoKey();

          const origPath = originalStoragePath(
            user.id,
            m.property_id,
            photoKey
          );
          const { data: origPublic } = supabase.storage
            .from(WM_BUCKET)
            .getPublicUrl(origPath);

          // 1. Prefer the archived original (single request; a 4xx simply
          //    means we have never archived this photo).
          let source: Blob | null = null;
          try {
            const r = await fetch(origPublic.publicUrl, { cache: "no-store" });
            if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) {
              source = await r.blob();
            }
          } catch {
            /* no archived original — handled below */
          }

          // 2. No archive: only safe to use the live photo when it is NOT
          //    already stamped, otherwise we would bake a second watermark.
          if (!source) {
            if (isWatermarked(m.url)) {
              skipped++;
              skippedProps.add(m.property_id);
              continue;
            }
            source = await fetchImageAsBlob(m.url);
            const { error: archiveErr } = await supabase.storage
              .from(WM_BUCKET)
              .upload(origPath, source, {
                upsert: true,
                cacheControl: "31536000",
                contentType: source.type || "image/jpeg",
              });
            // Archiving is best-effort: if the bucket policy rejects it we can
            // still stamp now, we just won't be able to re-stamp later.
            if (archiveErr) logError("watermark: archive original", archiveErr);
          }

          // 3. Stamp.
          const result = await applyWatermarkDetailed(source, watermark);
          if (!result.watermarked) {
            failed++;
            lastError = result.error ?? "No se pudo aplicar la marca de agua.";
            continue;
          }

          // 4. Upload under a path versioned by the config signature, so the
          //    URL changes whenever the look changes and no cache (browser or
          //    CDN) can keep serving the previous render.
          const path = watermarkStoragePath(
            user.id,
            m.property_id,
            photoKey,
            signature
          );
          const { error: upErr } = await supabase.storage
            .from(WM_BUCKET)
            .upload(path, result.blob, {
              cacheControl: "31536000",
              upsert: true,
              contentType: "image/jpeg",
            });
          if (upErr) throw upErr;

          const {
            data: { publicUrl },
          } = supabase.storage.from(WM_BUCKET).getPublicUrl(path);
          const versionedUrl = withCacheBust(publicUrl, signature);

          const { error: updErr } = await supabase
            .from("property_media")
            .update({ url: versionedUrl })
            .eq("id", m.id);
          if (updErr) throw updErr;

          // 5. Clean up the object we just replaced: either the previous render
          //    or the now-archived unstamped source (which would otherwise stay
          //    publicly downloadable without a watermark). Never touch the
          //    archive itself, other users' folders, or a shared object.
          const removable =
            prevPath &&
            prevPath !== path &&
            prevPath.startsWith(`${user.id}/`) &&
            !prevPath.includes(`/${ORIGINALS_DIR}/`) &&
            (urlUses.get(m.url) ?? 0) === 1;
          if (removable && prevPath) {
            const { error: rmErr } = await supabase.storage
              .from(WM_BUCKET)
              .remove([prevPath]);
            if (rmErr) logError("watermark: cleanup previous object", rmErr);
          }

          touchedProps.add(m.property_id);
          done++;
        } catch (err) {
          failed++;
          lastError =
            err instanceof Error ? err.message : "Error desconocido.";
          logError("Error reprocessing media", err);
        }
      }

      // Refresh featured_image_url for each touched property (cover = sort_order 0).
      for (const pid of touchedProps) {
        // Same reason: the cover is a PHOTO. Videos sort after the photos, so
        // an unfiltered `limit(1)` usually lands on a photo — but on a listing
        // published with video and no photos it would set a video URL as
        // `featured_image_url` and every listing card would break.
        const { data: cover } = await supabase
          .from("property_media")
          .select("url")
          .eq("property_id", pid)
          .eq("media_type", "IMAGE")
          .order("sort_order", { ascending: true })
          .limit(1);
        if (cover?.[0]?.url) {
          await supabase
            .from("properties")
            .update({ featured_image_url: cover[0].url })
            .eq("id", pid);
        }
      }

      const parts = [`${done} foto(s) actualizada(s)`];
      if (skipped > 0) parts.push(`${skipped} omitida(s)`);
      if (failed > 0) parts.push(`${failed} con error`);
      // Only claim success when something actually changed — a run that skips
      // everything used to end with a "✓", which reads as "ya quedó".
      setReprocessMsg(
        done > 0
          ? `Listo: ${parts.join(", ")}. ✓`
          : `No se actualizó ninguna foto: ${parts.join(", ")}.`
      );

      const problems: string[] = [];
      if (skipped > 0) {
        const names = [...skippedProps]
          .map((pid) => titleById.get(pid) ?? "Sin título")
          .slice(0, 5);
        const extra = skippedProps.size - names.length;
        problems.push(
          `No se pudieron actualizar ${skipped} foto(s): se subieron con la marca ` +
            "ya integrada en la imagen y sin copia del original, así que volver a " +
            "marcarlas duplicaría la marca. La única forma de cambiarles la marca " +
            "es volver a subir esas fotos desde la edición de la propiedad" +
            (names.length
              ? ` (${names.join(", ")}${extra > 0 ? ` y ${extra} más` : ""}).`
              : ".") +
            " Las fotos que subas de ahora en adelante sí guardan su original y " +
            "se podrán volver a marcar las veces que quieras."
        );
      }
      if (failed > 0 && lastError) {
        problems.push(`${failed} foto(s) fallaron. Último error: ${lastError}`);
      }
      setReprocessError(problems.length ? problems.join(" ") : null);
    } catch (err) {
      logError("Error reprocessing existing photos", err);
      setReprocessMsg(null);
      setReprocessError(
        err instanceof Error
          ? `Ocurrió un error al reprocesar las fotos: ${err.message}`
          : "Ocurrió un error al reprocesar las fotos."
      );
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
        {saveState === "saving" && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Guardando…
          </span>
        )}
        {saveState === "saved" && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 animate-fade-in-up">
            ✓ Guardado
          </span>
        )}
        {saveState === "error" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {saveError ?? "No se pudieron guardar los cambios."}
            </span>
            <button
              type="button"
              onClick={() => {
                persistPrefs(notifications, watermark);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Reintentar
            </button>
          </div>
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
              {logoError && (
                <p className="flex items-start gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {logoError}
                </p>
              )}
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
                      // Debounced: a drag fires dozens of change events and one
                      // auth write per event would race / rate-limit.
                      updateWatermark(
                        { opacity: Number(e.target.value) / 100 },
                        false
                      )
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
                      updateWatermark(
                        { scale: Number(e.target.value) / 100 },
                        false
                      )
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
                        style={{ opacity: watermark.opacity }}
                      >
                        {previewTileOrigins(watermark.scale, logoAspect).map(
                          (o) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${o.x}-${o.y}`}
                              src={watermark.url ?? undefined}
                              alt=""
                              onLoad={handleLogoMeasured}
                              className="absolute"
                              style={{
                                left: `${o.x * 100}%`,
                                top: `${o.y * 100}%`,
                                width: `${watermark.scale * 100}%`,
                              }}
                            />
                          )
                        )}
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={watermark.url}
                        alt="Marca de agua"
                        onLoad={handleLogoMeasured}
                        className="pointer-events-none absolute"
                        style={{
                          ...previewAnchorStyle(watermark.position),
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
                  Vuelve a procesar tus fotos publicadas con la configuración
                  actual. Guardamos una copia original de cada foto para poder
                  cambiar la marca cuantas veces quieras sin encimarlas.
                </p>
                {reprocessMsg && (
                  <p className="mt-1 text-xs font-medium text-blue-600">
                    {reprocessMsg}
                  </p>
                )}
                {reprocessError && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-red-600">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{reprocessError}</span>
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
