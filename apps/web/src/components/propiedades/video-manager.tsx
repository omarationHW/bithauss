"use client";

/**
 * Shared video picker/organizer for the property forms (alta y edición).
 *
 * Mirrors <PhotoManager/> on purpose — same dropzone, same reorder/principal/
 * delete affordances, same Spanish copy — so the publisher does not have to
 * learn a second interaction. Two things differ, because video is not a photo:
 *
 *  1. A video may come from a FILE or from a YouTube/Vimeo link. Most brokers
 *     already published their walkthrough; forcing a re-upload wastes their
 *     time and our storage.
 *  2. Uploads start IMMEDIATELY and show real progress. Photos are small
 *     enough to defer to submit; a 200 MB video is not — deferring it would
 *     freeze the "Publicar" button for minutes with no feedback.
 *
 * The list is controlled by the parent (like PhotoManager) so the submit
 * handler always writes exactly what the publisher sees. `onChange` takes an
 * updater function because uploads resolve asynchronously and two of them may
 * settle in the same tick.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Film,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Star,
  Video,
  X,
} from "lucide-react";

import {
  MAX_PROPERTY_VIDEOS,
  MAX_VIDEO_FILE_BYTES,
  VIDEO_INPUT_ACCEPT,
  VIDEO_SNIFF_BYTES,
  canAddVideos,
  formatBytes,
  parseVideoUrl,
  validateVideoFile,
  type VideoProvider,
} from "@/lib/property-video";
import { UPLOAD_ABORTED } from "@/lib/video-upload";

export { MAX_PROPERTY_VIDEOS };

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type VideoDraftStatus = "ready" | "uploading" | "error";

export interface PropertyVideoDraft {
  /** Stable React key (DB id for saved rows, synthetic for new ones). */
  key: string;
  /** property_media.id when the row already exists in the database. */
  id?: string;
  provider: VideoProvider;
  /** Public URL (uploads) or canonical provider URL. Empty while uploading. */
  url: string;
  externalId: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  status: VideoDraftStatus;
  /** 0-100, only meaningful while `status === "uploading"`. */
  progress: number;
  error: string | null;
  /** Kept for retry after a failed upload. */
  file?: File;
  /** blob: URL used for the local preview before/while uploading. */
  localPreview?: string | null;
  /** MIME detected from the magic bytes, forwarded to Storage. */
  contentType?: string;
}

/** Injected so tests (and any future backend) can drive uploads. */
export interface VideoUploadTask {
  promise: Promise<string>;
  abort: () => void;
}

export type VideoUploadStarter = (
  file: File,
  onProgress: (percent: number) => void,
  contentType?: string,
) => VideoUploadTask;

interface VideoManagerProps {
  items: PropertyVideoDraft[];
  onChange: (
    update: (prev: PropertyVideoDraft[]) => PropertyVideoDraft[],
  ) => void;
  /** Starts an upload; omit to offer links only (e.g. session not ready). */
  startUpload?: VideoUploadStarter;
  max?: number;
  maxBytes?: number;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** jsdom (and old Safari) may not implement createObjectURL — never crash. */
function safeObjectUrl(file: File): string | null {
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

const PROVIDER_LABEL: Record<VideoProvider, string> = {
  UPLOAD: "Archivo subido",
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
};

/** Reorder helpers kept local so the manager has no import cycle with photos. */
export function moveVideo(
  list: PropertyVideoDraft[],
  from: number,
  to: number,
): PropertyVideoDraft[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export function promoteVideo(
  list: PropertyVideoDraft[],
  index: number,
): PropertyVideoDraft[] {
  if (index <= 0 || index >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.unshift(item!);
  return copy;
}

/** True while any video is still uploading — the forms block submit on this. */
export function hasPendingVideoUploads(items: PropertyVideoDraft[]): boolean {
  return items.some((v) => v.status === "uploading");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VideoManager({
  items,
  onChange,
  startUpload,
  max = MAX_PROPERTY_VIDEOS,
  maxBytes = MAX_VIDEO_FILE_BYTES,
  disabled = false,
}: VideoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef<Map<string, VideoUploadTask>>(new Map());

  const [urlValue, setUrlValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const full = items.length >= max;

  // Abort any upload still running when the form unmounts, otherwise the
  // request keeps the tab busy after the user navigated away.
  useEffect(() => {
    const tasks = tasksRef.current;
    return () => {
      tasks.forEach((task) => task.abort());
      tasks.clear();
    };
  }, []);

  // Errors are announced AND focused: a rejected 200 MB file that only paints
  // red text below the fold reads as "nothing happened".
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const patch = useCallback(
    (key: string, changes: Partial<PropertyVideoDraft>) => {
      onChange((prev) =>
        prev.map((item) => (item.key === key ? { ...item, ...changes } : item)),
      );
    },
    [onChange],
  );

  const runUpload = useCallback(
    (draft: PropertyVideoDraft) => {
      if (!startUpload || !draft.file) return;

      const task = startUpload(
        draft.file,
        (percent) => patch(draft.key, { progress: percent }),
        draft.contentType,
      );
      tasksRef.current.set(draft.key, task);

      task.promise
        .then((url) => {
          patch(draft.key, { url, status: "ready", progress: 100, error: null });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          // A cancel is a user action, not a failure: the row is already gone.
          if (message === UPLOAD_ABORTED) return;
          patch(draft.key, {
            status: "error",
            error: message || "No se pudo subir el video.",
          });
        })
        .finally(() => {
          tasksRef.current.delete(draft.key);
        });
    },
    [patch, startUpload],
  );

  /* ---- Add by file ---- */

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      const list = Array.from(files);
      if (list.length === 0) return;

      setError(null);

      let room = max - items.length;
      if (room <= 0) {
        setError(canAddVideos(items.length, 1, max).message ?? null);
        return;
      }

      for (const file of list) {
        if (room <= 0) {
          setError(canAddVideos(max, 1, max).message ?? null);
          break;
        }

        // Read only the header: the extension and File.type are both
        // client-controlled, the first bytes are not.
        let head: Uint8Array | undefined;
        try {
          const buffer = await file.slice(0, VIDEO_SNIFF_BYTES).arrayBuffer();
          head = new Uint8Array(buffer);
        } catch {
          head = undefined;
        }

        const check = validateVideoFile(file, { maxBytes, head });
        if (!check.ok) {
          setError(check.message ?? "No se pudo agregar el video.");
          continue;
        }

        if (!startUpload) {
          setError(
            "Aún no podemos subir archivos. Vuelve a intentarlo en unos segundos o pega la liga de YouTube o Vimeo.",
          );
          return;
        }

        const draft: PropertyVideoDraft = {
          key: newKey(),
          provider: "UPLOAD",
          url: "",
          externalId: null,
          thumbnailUrl: null,
          title: file.name,
          status: "uploading",
          progress: 0,
          error: null,
          file,
          localPreview: safeObjectUrl(file),
          contentType: check.detectedMime,
        };

        room -= 1;
        onChange((prev) => [...prev, draft]);
        runUpload(draft);
      }
    },
    [disabled, items.length, max, maxBytes, onChange, runUpload, startUpload],
  );

  /* ---- Add by URL ---- */

  function addUrl() {
    if (disabled) return;
    setError(null);

    const raw = urlValue.trim();
    if (!raw) {
      setError("Pega la liga del video de YouTube o Vimeo.");
      return;
    }

    const limit = canAddVideos(items.length, 1, max);
    if (!limit.ok) {
      setError(limit.message ?? null);
      return;
    }

    const parsed = parseVideoUrl(raw);
    if (!parsed) {
      setError(
        "Esa liga no es válida. Acepta solo videos de YouTube o Vimeo, por ejemplo https://youtu.be/xxxxxxxxxxx o https://vimeo.com/123456789.",
      );
      return;
    }

    if (items.some((item) => item.url === parsed.canonicalUrl)) {
      setError("Ese video ya está agregado.");
      return;
    }

    onChange((prev) => [
      ...prev,
      {
        key: newKey(),
        provider: parsed.provider,
        url: parsed.canonicalUrl,
        externalId: parsed.externalId,
        thumbnailUrl: parsed.thumbnailUrl,
        title: null,
        status: "ready",
        progress: 100,
        error: null,
      },
    ]);

    setUrlValue("");
    urlInputRef.current?.focus();
  }

  /* ---- Remove / cancel / retry ---- */

  function removeVideo(key: string) {
    const task = tasksRef.current.get(key);
    if (task) {
      task.abort();
      tasksRef.current.delete(key);
    }
    onChange((prev) => {
      const target = prev.find((item) => item.key === key);
      if (target?.localPreview) {
        try {
          URL.revokeObjectURL(target.localPreview);
        } catch {
          /* jsdom / unsupported */
        }
      }
      return prev.filter((item) => item.key !== key);
    });
    setError(null);
  }

  function retry(item: PropertyVideoDraft) {
    if (!item.file) return;
    patch(item.key, { status: "uploading", progress: 0, error: null });
    runUpload({ ...item, status: "uploading", progress: 0, error: null });
  }

  const uploadingLabel = useMemo(() => {
    const uploading = items.filter((item) => item.status === "uploading");
    if (uploading.length === 0) return "";
    const first = uploading[0]!;
    return `Subiendo ${first.title ?? "video"}: ${first.progress}%`;
  }, [items]);

  /* ---- Render ---- */

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full && !disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!full && !disabled && e.dataTransfer.files) {
            void addFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => {
          if (!full && !disabled) fileInputRef.current?.click();
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200 sm:px-6 sm:py-12 ${
          full || disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            : dragOver
              ? "cursor-pointer border-blue-400 bg-blue-50"
              : "cursor-pointer border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        }`}
      >
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
          }}
        >
          <Video className="h-6 w-6" style={{ color: "hsl(221 83% 53%)" }} />
        </div>
        <p className="text-sm font-semibold text-gray-700">
          {full
            ? `Alcanzaste el máximo de ${max} videos`
            : "Arrastra tu video aquí o haz clic para seleccionarlo"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          MP4, WebM o MOV. Hasta {formatBytes(maxBytes)} por video. Máximo {max}{" "}
          videos ({items.length} agregados).
        </p>
        <label className="sr-only" htmlFor="property-video-file">
          Subir video de la propiedad
        </label>
        <input
          id="property-video-file"
          ref={fileInputRef}
          type="file"
          accept={VIDEO_INPUT_ACCEPT}
          multiple
          disabled={full || disabled}
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* External link */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <label
          htmlFor="property-video-url"
          className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700"
        >
          <Link2 className="h-4 w-4 text-gray-400" />
          ¿Tu video ya está en YouTube o Vimeo?
        </label>
        <p className="mb-2 text-xs text-gray-500">
          Pega la liga y la mostramos en la ficha de la propiedad. No necesitas
          volver a subirlo.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="property-video-url"
            ref={urlInputRef}
            type="url"
            inputMode="url"
            value={urlValue}
            disabled={disabled}
            placeholder="https://youtu.be/xxxxxxxxxxx"
            aria-describedby="property-video-url-hint"
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // The manager lives inside a <form>-less page, but Enter must
                // never bubble up as a submit in either host.
                e.preventDefault();
                addUrl();
              }
            }}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={addUrl}
            // NOT disabled when the list is full: clicking has to explain the
            // limit out loud instead of silently doing nothing.
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }}
          >
            Agregar video
          </button>
        </div>
        <p id="property-video-url-hint" className="mt-1.5 text-[11px] text-gray-400">
          Ejemplos válidos: youtu.be/ID, youtube.com/watch?v=ID, vimeo.com/123456789
        </p>
      </div>

      {/* Errors — announced and focusable */}
      <p
        ref={errorRef}
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className={
          error
            ? "flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 outline-none"
            : "sr-only"
        }
      >
        {error ? (
          <>
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </>
        ) : null}
      </p>

      {/* Progress announcements for screen readers */}
      <p className="sr-only" aria-live="polite">
        {uploadingLabel}
      </p>

      {/* List */}
      {items.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            El primer video (
            <span className="font-semibold text-blue-600">Principal</span>) es el
            que se reproduce en la ficha; usa{" "}
            <Star className="inline h-3 w-3" /> para hacer principal cualquier
            otro.
          </p>

          <ul className="space-y-3">
            {items.map((item, idx) => (
              <li
                key={item.key}
                className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${
                  idx === 0
                    ? "border-blue-400 bg-blue-50/40 ring-2 ring-blue-100"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Preview */}
                <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden rounded-lg bg-gray-900 sm:w-44">
                  {item.provider === "UPLOAD" ? (
                    item.localPreview || item.url ? (
                      // preload="metadata" so the poster frame appears without
                      // pulling the whole file; muted + no autoplay by design.
                      <video
                        src={item.localPreview || item.url}
                        preload="metadata"
                        controls
                        muted
                        playsInline
                        aria-label={`Vista previa de ${item.title ?? "el video"}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film className="h-6 w-6 text-white/60" />
                      </div>
                    )
                  ) : item.thumbnailUrl ? (
                    // Plain <img>: the provider thumbnail is a third-party host
                    // and must not go through the Next image loader.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/70">
                      <Play className="h-5 w-5" />
                      <span className="text-[10px] font-semibold uppercase">
                        {PROVIDER_LABEL[item.provider]}
                      </span>
                    </div>
                  )}
                  {idx === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Principal
                    </span>
                  )}
                </div>

                {/* Meta + progress */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {item.title ?? item.url}
                  </p>
                  <p className="text-xs text-gray-500">
                    {PROVIDER_LABEL[item.provider]}
                    {item.provider !== "UPLOAD" && item.externalId
                      ? ` · ${item.externalId}`
                      : ""}
                  </p>

                  {item.status === "uploading" && (
                    <div className="mt-2">
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.progress}
                        aria-label={`Progreso de subida de ${item.title ?? "el video"}`}
                        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
                      >
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${item.progress}%`,
                            background:
                              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                          }}
                        />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Subiendo… {item.progress}%
                      </p>
                    </div>
                  )}

                  {item.status === "error" && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      {item.error}
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {item.status === "error" && item.file && (
                    <button
                      type="button"
                      onClick={() => retry(item)}
                      title="Reintentar"
                      aria-label={`Reintentar la subida de ${item.title ?? "el video"}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}

                  {idx > 0 && item.status === "ready" && (
                    <button
                      type="button"
                      onClick={() => onChange((prev) => promoteVideo(prev, idx))}
                      title="Hacer principal"
                      aria-label={`Hacer principal ${item.title ?? "el video"}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onChange((prev) => moveVideo(prev, idx, idx - 1))}
                    title="Mover antes"
                    aria-label={`Mover antes ${item.title ?? "el video"}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => onChange((prev) => moveVideo(prev, idx, idx + 1))}
                    title="Mover después"
                    aria-label={`Mover después ${item.title ?? "el video"}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeVideo(item.key)}
                    title={item.status === "uploading" ? "Cancelar subida" : "Eliminar"}
                    aria-label={
                      item.status === "uploading"
                        ? `Cancelar la subida de ${item.title ?? "el video"}`
                        : `Eliminar ${item.title ?? "el video"}`
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
