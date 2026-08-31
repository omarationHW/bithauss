/**
 * Pure logic behind "incluir video en el alta de propiedades".
 *
 * Lives in @bithauss/validators — not in the web app — so the alta/edición
 * forms, the public ficha, the Zod schemas and the NestJS media endpoints all
 * validate against ONE transcription of the rules. A second copy of the host
 * allowlist is exactly the kind of thing that drifts and quietly re-opens the
 * embed hole it was meant to close.
 *
 * Everything here is side-effect free (no network, no DOM) so it can be shared
 * by the alta/edición forms, the public listing and the tests. Two origins are
 * supported on purpose:
 *
 *   UPLOAD  — the broker owns an MP4/WebM/MOV file and we host it.
 *   YOUTUBE / VIMEO — the broker already published the tour and only wants to
 *                     embed it. Re-uploading it would cost storage twice.
 *
 * The external branch is the security-sensitive one: whatever we store here
 * ends up in an <iframe src> on the public ficha. Accepting an arbitrary URL
 * would hand an attacker a stored-XSS primitive (`javascript:`), a data: URI
 * frame, or an SSRF-ish embed of an internal host. So we never echo the user's
 * URL back: we parse it, verify the host against an exact allowlist, extract
 * the provider's video id, and REBUILD a canonical URL from that id.
 */

/* ------------------------------------------------------------------ */
/*  Limits                                                             */
/* ------------------------------------------------------------------ */

/**
 * Max videos per property.
 *
 * Three covers the realistic cases (recorrido general, drone, amenidades)
 * without turning a listing into a playlist that nobody watches — and it keeps
 * the worst-case storage per property bounded (3 x 200 MB).
 */
export const MAX_PROPERTY_VIDEOS = 3;

/**
 * Max size of an uploaded video file, in bytes.
 *
 * 200 MB is roughly a 3-4 minute 1080p H.264 clip at ~8 Mbps, which is what a
 * property walkthrough recorded on a phone actually weighs. It also stays
 * under Supabase Storage's default per-file ceiling (the bucket is created
 * with this exact `file_size_limit` in migration 030, so the server rejects
 * oversized uploads even if the browser check is bypassed).
 */
export const MAX_VIDEO_FILE_BYTES = 200 * 1024 * 1024;

/** Human-readable size, for the Spanish error copy. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ------------------------------------------------------------------ */
/*  Providers                                                          */
/* ------------------------------------------------------------------ */

export type VideoProvider = 'UPLOAD' | 'YOUTUBE' | 'VIMEO';

export interface ParsedExternalVideo {
  provider: 'YOUTUBE' | 'VIMEO';
  /** Provider-side id (11 chars for YouTube, digits for Vimeo). */
  externalId: string;
  /** Canonical watch URL, rebuilt from the id — never the raw user input. */
  canonicalUrl: string;
  /** URL for the <iframe src> (privacy-preserving host where available). */
  embedUrl: string;
  /** Provider thumbnail, or null when it cannot be derived without an API call. */
  thumbnailUrl: string | null;
}

/**
 * Exact hostnames we accept. Matching is `===` on the parsed hostname, never
 * `includes()` / `endsWith()`: `youtube.com.evil.tld` and
 * `evil.tld/youtube.com/watch` both defeat substring checks.
 */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/** YouTube ids are exactly 11 chars of the URL-safe base64 alphabet. */
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
/** Vimeo ids are numeric. */
const VIMEO_ID_RE = /^\d{6,12}$/;
/** Vimeo "unlisted" privacy hash (vimeo.com/<id>/<hash>). */
const VIMEO_HASH_RE = /^[A-Za-z0-9]{6,20}$/;

/** A URL that already carries an explicit scheme, e.g. `javascript:`, `https:`. */
const HAS_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * Turns free-form user input into a URL we are willing to look at.
 *
 * Returns null (rather than throwing) for anything that is not a plain
 * http(s) URL: `javascript:`, `data:`, `vbscript:`, protocol-relative
 * `//host`, or a URL carrying credentials (`https://user:pass@youtube.com/…`,
 * a classic way to make a phishing host look legitimate).
 */
function safeParseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Protocol-relative input would inherit our scheme and hide the real host.
  if (trimmed.startsWith('//')) return null;
  // Control characters and embedded whitespace are used to smuggle schemes
  // past naive checks ("java\tscript:alert(1)"), so reject them outright.
  if (/[\u0000-\u0020\u007f]/.test(trimmed)) return null;

  const candidate = HAS_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;

  return url;
}

/** Lowercased path segments with empties removed. */
function segments(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function youtubeThumbnail(id: string): string {
  // i.ytimg.com serves the still without loading any YouTube script.
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function buildYouTube(id: string): ParsedExternalVideo {
  return {
    provider: 'YOUTUBE',
    externalId: id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    // -nocookie defers YouTube's tracking cookies until playback starts.
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    thumbnailUrl: youtubeThumbnail(id),
  };
}

function buildVimeo(id: string, hash: string | null): ParsedExternalVideo {
  const query = hash ? `?h=${hash}` : '';
  return {
    provider: 'VIMEO',
    externalId: hash ? `${id}:${hash}` : id,
    canonicalUrl: `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`,
    embedUrl: `https://player.vimeo.com/video/${id}${query}${
      query ? '&' : '?'
    }autoplay=1`,
    // Vimeo thumbnails require an oEmbed round-trip; we deliberately do NOT
    // fetch at parse time (this module stays pure and makes no network calls),
    // so the UI falls back to a neutral poster.
    thumbnailUrl: null,
  };
}

/**
 * Parses a YouTube/Vimeo URL into a canonical, embeddable descriptor.
 * Returns null when the input is not a supported, well-formed provider URL.
 *
 * Accepted shapes:
 *   youtu.be/ID                    youtube.com/watch?v=ID
 *   youtube.com/embed/ID           youtube.com/shorts/ID
 *   youtube.com/live/ID            youtube.com/v/ID
 *   vimeo.com/ID                   vimeo.com/ID/HASH (unlisted)
 *   player.vimeo.com/video/ID      vimeo.com/channels/x/ID
 */
export function parseVideoUrl(raw: string): ParsedExternalVideo | null {
  const url = safeParseUrl(raw);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const parts = segments(url);

  if (YOUTUBE_HOSTS.has(host)) {
    // youtu.be/<id>
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = parts[0] ?? '';
      return YOUTUBE_ID_RE.test(id) ? buildYouTube(id) : null;
    }

    // /watch?v=<id>
    if (parts[0] === 'watch') {
      const id = url.searchParams.get('v') ?? '';
      return YOUTUBE_ID_RE.test(id) ? buildYouTube(id) : null;
    }

    // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
    if (
      parts.length >= 2 &&
      ['embed', 'shorts', 'live', 'v'].includes(parts[0] as string)
    ) {
      const id = parts[1] ?? '';
      return YOUTUBE_ID_RE.test(id) ? buildYouTube(id) : null;
    }

    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    // player.vimeo.com/video/<id>[?h=hash]
    if (host === 'player.vimeo.com') {
      if (parts[0] !== 'video') return null;
      const id = parts[1] ?? '';
      if (!VIMEO_ID_RE.test(id)) return null;
      const hash = url.searchParams.get('h');
      return buildVimeo(id, hash && VIMEO_HASH_RE.test(hash) ? hash : null);
    }

    // vimeo.com/<id>[/<hash>] and vimeo.com/channels/<name>/<id>
    const numericIndex = parts.findIndex((p) => VIMEO_ID_RE.test(p));
    if (numericIndex === -1) return null;
    const id = parts[numericIndex] as string;
    const next = parts[numericIndex + 1];
    const hash = next && VIMEO_HASH_RE.test(next) && !VIMEO_ID_RE.test(next) ? next : null;
    return buildVimeo(id, hash);
  }

  return null;
}

/** True when the stored URL is safe to hand to an <iframe src>. */
export function isEmbeddableVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

/**
 * Rebuilds the embed URL for a stored row. Reparsing (instead of trusting the
 * stored string) means a row written before this validation existed — or one
 * inserted straight into Postgres — still cannot inject an arbitrary frame.
 */
export function embedUrlFor(
  provider: VideoProvider | string | null,
  url: string,
): string | null {
  if (provider === 'UPLOAD') return null;
  return parseVideoUrl(url)?.embedUrl ?? null;
}

/* ------------------------------------------------------------------ */
/*  File validation                                                    */
/* ------------------------------------------------------------------ */

export const ACCEPTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ACCEPTED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'] as const;

/** `accept` attribute for the file input. */
export const VIDEO_INPUT_ACCEPT = '.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime';

export type VideoRejectionCode =
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'BAD_EXTENSION'
  | 'BAD_CONTENT'
  | 'LIMIT_REACHED';

export interface VideoValidationResult {
  ok: boolean;
  code?: VideoRejectionCode;
  /** Spanish copy shown to the publisher, explaining WHY it was rejected. */
  message?: string;
  /** MIME type detected from the magic bytes (not from `File.type`). */
  detectedMime?: string;
}

const OK: VideoValidationResult = { ok: true };

/** How many leading bytes `sniffVideoMime` needs. */
export const VIDEO_SNIFF_BYTES = 16;

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let out = '';
  for (let i = from; i < to && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] as number);
  }
  return out;
}

/**
 * Detects the container from the file's leading bytes.
 *
 * Mirrors the API's MagicBytesValidator: `File.type` and the extension are
 * both attacker-controlled, so an .mp4 that is really an HTML page (or a
 * polyglot) would otherwise be stored in a PUBLIC bucket and served from our
 * own origin. Returns null when nothing matches.
 *
 *   MP4/MOV — ISO base media: bytes 4..8 are the literal "ftyp" box type; the
 *             brand at 8..12 separates QuickTime ("qt  ") from MP4.
 *   WebM    — Matroska/EBML header 1A 45 DF A3.
 */
export function sniffVideoMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) {
    // EBML only needs 4 bytes.
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return 'video/webm';
    }
    return null;
  }

  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return 'video/webm';
  }

  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'qt  ') return 'video/quicktime';
    // isom, iso2, mp41, mp42, avc1, M4V , dash, …
    return 'video/mp4';
  }

  return null;
}

/** Lowercased extension without the dot, or "" when there is none. */
export function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export interface ValidateVideoFileOptions {
  maxBytes?: number;
  /** First bytes of the file; when provided, the container is verified. */
  head?: Uint8Array;
}

/**
 * Validates name/size and — when `head` is supplied — the real container.
 *
 * `head` is optional so the same function can run in a synchronous context
 * (extension + size only); the manager always reads the first bytes first, so
 * in the product the content check always runs.
 */
export function validateVideoFile(
  file: { name: string; size: number; type?: string },
  options: ValidateVideoFileOptions = {},
): VideoValidationResult {
  const maxBytes = options.maxBytes ?? MAX_VIDEO_FILE_BYTES;

  if (!file || file.size <= 0) {
    return {
      ok: false,
      code: 'EMPTY',
      message: 'El archivo está vacío o no se pudo leer. Inténtalo de nuevo.',
    };
  }

  const ext = fileExtension(file.name);
  if (!(ACCEPTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      code: 'BAD_EXTENSION',
      message: `Formato no admitido${ext ? ` (.${ext})` : ''}. Sube un archivo MP4, WebM o MOV.`,
    };
  }

  if (file.size > maxBytes) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      message: `El video pesa ${formatBytes(file.size)} y el máximo permitido es ${formatBytes(
        maxBytes,
      )}. Comprímelo o súbelo a YouTube y pega la liga.`,
    };
  }

  if (options.head) {
    const detected = sniffVideoMime(options.head);
    if (!detected) {
      return {
        ok: false,
        code: 'BAD_CONTENT',
        message:
          'El contenido del archivo no corresponde a un video MP4, WebM o MOV. Verifica que no esté dañado.',
      };
    }
    // A .webm whose bytes are MP4 is fine to store (we trust the bytes), but a
    // file whose bytes are not video at all was already rejected above.
    return { ok: true, detectedMime: detected };
  }

  return OK;
}

/**
 * Per-property limit check. Kept here (not in the component) so alta, edición
 * and any future bulk importer enforce the same number.
 */
export function canAddVideos(
  currentCount: number,
  adding = 1,
  max = MAX_PROPERTY_VIDEOS,
): VideoValidationResult {
  if (currentCount + adding > max) {
    return {
      ok: false,
      code: 'LIMIT_REACHED',
      message:
        max === 1
          ? 'Solo puedes agregar un video por propiedad.'
          : `Solo puedes agregar ${max} videos por propiedad.`,
    };
  }
  return OK;
}

/* ------------------------------------------------------------------ */
/*  Media row helpers                                                  */
/* ------------------------------------------------------------------ */

export interface PropertyMediaLike {
  id?: string;
  url: string;
  media_type?: string | null;
  provider?: string | null;
  external_id?: string | null;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  sort_order?: number | null;
  is_primary?: boolean | null;
}

/** True for rows that must NOT be rendered as photos. */
export function isVideoMedia(row: PropertyMediaLike): boolean {
  return (row.media_type ?? 'IMAGE').toUpperCase() === 'VIDEO';
}

/**
 * Splits a `property_media` result set.
 *
 * The public ficha used to map EVERY row into <Image>; once video rows share
 * the table, an unfiltered gallery would try to render an .mp4 as a photo.
 * Both surfaces go through this helper so that cannot regress.
 */
export function splitPropertyMedia<T extends PropertyMediaLike>(
  rows: readonly T[],
): { images: T[]; videos: T[] } {
  const images: T[] = [];
  const videos: T[] = [];
  for (const row of rows) {
    (isVideoMedia(row) ? videos : images).push(row);
  }
  return { images, videos };
}
