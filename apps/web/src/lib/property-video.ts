/* ------------------------------------------------------------------ */
/*  Property video helpers — web re-export                             */
/*                                                                     */
/*  The parsing/validation rules live in @bithauss/validators           */
/*  (packages/validators/src/property-video.ts) so the forms, the Zod   */
/*  schemas and the NestJS endpoints share one allowlist, one size      */
/*  limit and one magic-byte table.                                     */
/*                                                                     */
/*  This module exists only so app code can keep importing from         */
/*  "@/lib/property-video", like @/lib/property-fields does.            */
/* ------------------------------------------------------------------ */

export {
  MAX_PROPERTY_VIDEOS,
  MAX_VIDEO_FILE_BYTES,
  VIDEO_SNIFF_BYTES,
  VIDEO_INPUT_ACCEPT,
  ACCEPTED_VIDEO_MIME_TYPES,
  ACCEPTED_VIDEO_EXTENSIONS,
  formatBytes,
  parseVideoUrl,
  isEmbeddableVideoUrl,
  embedUrlFor,
  sniffVideoMime,
  fileExtension,
  validateVideoFile,
  canAddVideos,
  isVideoMedia,
  splitPropertyMedia,
} from "@bithauss/validators";

export type {
  VideoProvider,
  ParsedExternalVideo,
  VideoRejectionCode,
  VideoValidationResult,
  ValidateVideoFileOptions,
  PropertyMediaLike,
} from "@bithauss/validators";
