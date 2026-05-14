import { FileValidator } from '@nestjs/common';
import { fromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

/**
 * Validates an uploaded file by reading its first bytes (magic number)
 * instead of trusting the client-supplied MIME header. Protects against
 * an attacker uploading a script labelled as image/png.
 */
export class MagicBytesValidator extends FileValidator<{ allowed: string[] }> {
  buildErrorMessage(): string {
    return 'Tipo de archivo no permitido. Acepta solo PDF, JPG o PNG.';
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file || !file.buffer) return false;

    const detected = await fromBuffer(file.buffer);
    if (!detected) return false;

    const mime = detected.mime;
    return ALLOWED_MIME_TYPES.has(mime);
  }
}
