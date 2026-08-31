import { FileValidator } from '@nestjs/common';
import { sniffVideoMime, ACCEPTED_VIDEO_MIME_TYPES } from '@bithauss/validators';

/**
 * Same idea as `common/validators/magic-bytes.validator.ts` (which guards
 * document uploads), applied to video: the container is decided by the file's
 * first bytes, never by the extension or the `Content-Type` the client sent.
 *
 * It matters more here than for documents because `property-videos` is a
 * PUBLIC bucket: a renamed .html served from a storage origin we control is a
 * stored-XSS delivery mechanism, and a "video" that is really an archive is
 * free hosting on our bill.
 *
 * Unlike the document validator this one needs no `file-type` import — the
 * three containers we accept are identified by a fixed 4-byte marker, and the
 * detector lives in @bithauss/validators so the browser and the API agree.
 */
export class VideoMagicBytesValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  buildErrorMessage(): string {
    return 'El archivo no es un video MP4, WebM o MOV válido.';
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file?.buffer) return false;

    const detected = sniffVideoMime(new Uint8Array(file.buffer.subarray(0, 16)));
    return (
      detected !== null &&
      (ACCEPTED_VIDEO_MIME_TYPES as readonly string[]).includes(detected)
    );
  }
}
