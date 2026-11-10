import { FileValidator } from '@nestjs/common';

export type AudioContainer = 'webm' | 'ogg' | 'mp4' | 'mp3' | 'wav';

/**
 * Content-Types a browser recorder or phone may label a voice note with.
 * Chrome/Firefox record webm/ogg (opus), Safari records mp4/m4a (aac).
 * Parameters such as `;codecs=opus` are stripped before comparing.
 */
export const ACCEPTED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
] as const;

/** Extension Azure uses to pick the decoder. */
export const AUDIO_EXTENSIONS: Record<AudioContainer, string> = {
  webm: 'webm',
  ogg: 'ogg',
  mp4: 'm4a',
  mp3: 'mp3',
  wav: 'wav',
};

/** Decides the container from the first bytes, never from the declared type. */
export function sniffAudioContainer(bytes: Uint8Array): AudioContainer | null {
  if (bytes.length < 12) return null;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(4, 8) === 'ftyp') return 'mp4';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'wav';
  if (ascii(0, 3) === 'ID3') return 'mp3';
  // Raw MPEG audio frame sync (11 set bits).
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return 'mp3';
  return null;
}

export function baseMime(mimetype: string | undefined): string {
  return (mimetype ?? '').split(';')[0]!.trim().toLowerCase();
}

/**
 * Same approach as `VideoMagicBytesValidator`: the declared Content-Type must
 * be an audio type we accept AND the bytes must really be one of the
 * containers — a renamed HTML/zip never reaches the paid transcription API.
 */
export class AudioFileValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  buildErrorMessage(): string {
    return 'El archivo no es un audio válido (WebM, OGG, MP4/M4A, MP3 o WAV).';
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file?.buffer) return false;
    if (!(ACCEPTED_AUDIO_MIME_TYPES as readonly string[]).includes(baseMime(file.mimetype))) {
      return false;
    }
    return sniffAudioContainer(new Uint8Array(file.buffer.subarray(0, 16))) !== null;
  }
}
