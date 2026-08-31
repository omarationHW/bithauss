"use client";

/**
 * Video block of the public property page.
 *
 * Rendering rules that are NOT cosmetic:
 *
 *  · Returns null when the listing has no video, so a property without one
 *    renders exactly the same markup it did before this feature existed.
 *  · Uploaded files use <video preload="metadata" poster>. A bare <video src>
 *    with default preload pulls the whole file on page load — on a 200 MB
 *    walkthrough that is egress we pay for on every visit, most of which never
 *    press play, plus a slow LCP on mobile data.
 *  · YouTube/Vimeo use a FACADE: we paint the provider thumbnail and only
 *    inject the <iframe> after a click. Embedding it eagerly would load
 *    ~1 MB of third-party script and set their cookies for every visitor.
 *  · The iframe src is REBUILT from the stored URL through the allowlist
 *    parser, never interpolated raw, and the frame is sandboxed. A row with a
 *    hostile URL therefore renders nothing instead of an attacker frame.
 *  · Nothing ever autoplays with sound: uploaded files are user-initiated via
 *    the native controls, and the provider embed only autoplays *after* the
 *    viewer clicked the facade (the click is the consent).
 */

import { useMemo, useState } from "react";
import { Play, Video as VideoIcon } from "lucide-react";

import { embedUrlFor, isVideoMedia, type PropertyMediaLike } from "@/lib/property-video";

export interface PropertyVideoGalleryProps {
  /** VIDEO rows of `property_media`, already ordered by sort_order. */
  videos: PropertyMediaLike[];
  /** Cover photo, used as poster when the video has no thumbnail of its own. */
  posterFallback?: string | null;
  title?: string;
}

/** Permissions the provider player actually needs — nothing more. */
const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";

/**
 * `allow-same-origin` here means "same origin as the FRAME" (youtube/vimeo),
 * not ours, so the player can reach its own APIs while staying unable to touch
 * this document. Forms and top-level navigation stay blocked.
 */
const IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox";

export function PropertyVideoGallery({
  videos,
  posterFallback,
  title = "Video de la propiedad",
}: PropertyVideoGalleryProps) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Drop rows we cannot render safely (hostile or malformed external URLs).
  const playable = useMemo(
    () =>
      videos.filter((video) => {
        // Defensive: a caller that forgets to split the media set must not end
        // up with a .jpg inside a <video>.
        if (video.media_type != null && !isVideoMedia(video)) return false;
        const provider = (video.provider ?? "UPLOAD").toUpperCase();
        if (provider === "UPLOAD") return Boolean(video.url);
        return embedUrlFor(provider, video.url) !== null;
      }),
    [videos],
  );

  if (playable.length === 0) return null;

  const current = playable[Math.min(active, playable.length - 1)]!;
  const provider = (current.provider ?? "UPLOAD").toUpperCase();
  const isUpload = provider === "UPLOAD";
  const embedUrl = isUpload ? null : embedUrlFor(provider, current.url);
  const poster = current.thumbnail_url || posterFallback || undefined;

  return (
    <section aria-labelledby="property-video-heading" className="mb-8">
      <h2
        id="property-video-heading"
        className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900"
      >
        <VideoIcon className="h-5 w-5 text-gray-400" />
        {title}
      </h2>

      {/* 16:9 wrapper — the player never dictates the layout height. */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-video">
        {isUpload ? (
          <video
            key={current.url}
            src={current.url}
            poster={poster}
            preload="metadata"
            controls
            playsInline
            aria-label={current.alt_text ?? title}
            className="h-full w-full object-contain"
          >
            Tu navegador no puede reproducir este video.{" "}
            <a href={current.url} className="underline">
              Descárgalo aquí.
            </a>
          </video>
        ) : playing && embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={current.alt_text ?? title}
            allow={IFRAME_ALLOW}
            sandbox={IFRAME_SANDBOX}
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Reproducir el video de la propiedad en ${
              provider === "VIMEO" ? "Vimeo" : "YouTube"
            }`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center"
          >
            {current.thumbnail_url ? (
              // Third-party still: a plain <img>, never the Next image loader.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.thumbnail_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 25%), hsl(160 84% 20%))",
                }}
              />
            )}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform duration-200 group-hover:scale-110">
              <Play className="ml-1 h-7 w-7 text-gray-900" fill="currentColor" />
            </span>
            <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white">
              Ver en {provider === "VIMEO" ? "Vimeo" : "YouTube"}
            </span>
          </button>
        )}
      </div>

      {playable.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {playable.map((video, idx) => (
            <button
              key={video.id ?? `${video.url}-${idx}`}
              type="button"
              onClick={() => {
                setActive(idx);
                setPlaying(false);
              }}
              aria-current={idx === active}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                idx === active
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Video {idx + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
