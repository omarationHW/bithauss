import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_TRANSCRIBE_API_VERSION,
  MAX_AUDIO_BYTES,
  MAX_MESSAGE_CHARS,
  TRANSCRIBE_TIMEOUT_MS,
} from './assistant.constants';
import { AUDIO_EXTENSIONS, baseMime, sniffAudioContainer } from './audio-file.validator';

/**
 * Voice note → text through Azure OpenAI `/audio/transcriptions`
 * (whisper / gpt-4o-mini-transcribe).
 *
 * Audio models are not available in every region, so the transcription
 * deployment may live on a different Azure resource than chat:
 * AZURE_OPENAI_TRANSCRIBE_ENDPOINT / _KEY override the shared ones.
 */
@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deployment: string;
  private readonly apiVersion: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = (
      this.config.get<string>('AZURE_OPENAI_TRANSCRIBE_ENDPOINT') ||
      this.config.get<string>('AZURE_OPENAI_ENDPOINT') ||
      ''
    ).replace(/\/+$/, '');
    this.apiKey =
      this.config.get<string>('AZURE_OPENAI_TRANSCRIBE_KEY') ||
      this.config.get<string>('AZURE_OPENAI_KEY') ||
      '';
    this.deployment = this.config.get<string>('AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT') ?? '';
    this.apiVersion =
      this.config.get<string>('AZURE_OPENAI_TRANSCRIBE_API_VERSION') || DEFAULT_TRANSCRIBE_API_VERSION;
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey && this.deployment);
  }

  /** Throws 503 before any work is done when the feature is not configured. */
  assertConfigured(): void {
    if (!this.deployment) {
      throw new ServiceUnavailableException(
        'La transcripción de voz no está configurada (falta AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT).',
      );
    }
    if (!this.endpoint || !this.apiKey) {
      throw new ServiceUnavailableException(
        'La transcripción de voz no está configurada (faltan el endpoint o la clave de Azure OpenAI).',
      );
    }
  }

  async transcribe(file: Express.Multer.File): Promise<{ text: string }> {
    this.assertConfigured();

    // Defence in depth — the controller pipe already checked both.
    if (!file?.buffer || file.size > MAX_AUDIO_BYTES || file.buffer.length > MAX_AUDIO_BYTES) {
      throw new BadRequestException('El audio debe pesar como máximo 1 MB (≈ 60 segundos).');
    }
    const container = sniffAudioContainer(new Uint8Array(file.buffer.subarray(0, 16)));
    if (!container) {
      throw new BadRequestException('El archivo no es un audio válido.');
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: baseMime(file.mimetype) || 'application/octet-stream' }),
      `nota.${AUDIO_EXTENSIONS[container]}`,
    );
    form.append('language', 'es');
    form.append('response_format', 'json');

    const url =
      `${this.endpoint}/openai/deployments/${encodeURIComponent(this.deployment)}` +
      `/audio/transcriptions?api-version=${encodeURIComponent(this.apiVersion)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'api-key': this.apiKey },
        body: form,
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`transcripción falló: ${(err as Error).message}`);
      throw new ServiceUnavailableException('No se pudo transcribir el audio. Intenta de nuevo.');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Azure transcription ${response.status}: ${body.slice(0, 200)}`);
      throw new ServiceUnavailableException('No se pudo transcribir el audio. Intenta de nuevo.');
    }

    const data = (await response.json()) as { text?: string; usage?: Record<string, unknown> };
    // Capped so the transcript always fits the chat DTO limit.
    const text = (data.text ?? '').trim().slice(0, MAX_MESSAGE_CHARS);
    this.logger.log(
      `transcribe usage deployment=${this.deployment} bytes=${file.size} container=${container} ` +
        `chars=${text.length}${data.usage ? ` usage=${JSON.stringify(data.usage)}` : ''}`,
    );
    return { text };
  }
}
