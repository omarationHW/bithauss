import 'reflect-metadata';
import {
  BadRequestException,
  MaxFileSizeValidator,
  ParseFilePipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { TranscriptionService } from './transcription.service';
import { AudioFileValidator, sniffAudioContainer } from './audio-file.validator';
import { MAX_AUDIO_BYTES } from './assistant.constants';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function config(env: Record<string, string>): ConfigService {
  return { get: (k: string) => env[k] } as unknown as ConfigService;
}

const FULL_ENV = {
  AZURE_OPENAI_ENDPOINT: 'https://main.openai.azure.com/',
  AZURE_OPENAI_KEY: 'main-key',
  AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'gpt-4o-mini-transcribe',
};

function webm(size = 2048): Buffer {
  const b = Buffer.alloc(size);
  b.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  return b;
}

function file(buffer: Buffer, mimetype = 'audio/webm;codecs=opus'): Express.Multer.File {
  return { originalname: 'blob', mimetype, buffer, size: buffer.length } as Express.Multer.File;
}

/** The exact pipe the controller uses. */
const pipe = () =>
  new ParseFilePipe({
    validators: [new MaxFileSizeValidator({ maxSize: MAX_AUDIO_BYTES }), new AudioFileValidator()],
  });

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});
afterEach(() => jest.restoreAllMocks());

/* ------------------------------------------------------------------ */

describe('TranscriptionService', () => {
  it('503 when AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT is missing', async () => {
    const svc = new TranscriptionService(
      config({ AZURE_OPENAI_ENDPOINT: FULL_ENV.AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY: FULL_ENV.AZURE_OPENAI_KEY }),
    );
    await expect(svc.transcribe(file(webm()))).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(svc.transcribe(file(webm()))).rejects.toThrow(/AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('503 when no endpoint/key is available at all', async () => {
    const svc = new TranscriptionService(config({ AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT: 'x' }));
    await expect(svc.transcribe(file(webm()))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('posts multipart audio in Spanish to the shared resource by default', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: '  oficina en Polanco  ' })));
    const svc = new TranscriptionService(config(FULL_ENV));

    await expect(svc.transcribe(file(webm()))).resolves.toEqual({ text: 'oficina en Polanco' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://main.openai.azure.com/openai/deployments/gpt-4o-mini-transcribe/audio/transcriptions?api-version=2025-03-01-preview',
    );
    expect((init.headers as Record<string, string>)['api-key']).toBe('main-key');
    expect(init.signal).toBeDefined();
    const form = init.body as FormData;
    expect(form.get('language')).toBe('es');
    expect((form.get('file') as File).name).toBe('nota.webm');
  });

  it('uses the dedicated transcription resource and api-version when configured', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: 'hola' })));
    const svc = new TranscriptionService(
      config({
        ...FULL_ENV,
        AZURE_OPENAI_TRANSCRIBE_ENDPOINT: 'https://audio-eastus2.openai.azure.com',
        AZURE_OPENAI_TRANSCRIBE_KEY: 'audio-key',
        AZURE_OPENAI_TRANSCRIBE_API_VERSION: '2025-04-01-preview',
      }),
    );
    await svc.transcribe(file(webm()));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith('https://audio-eastus2.openai.azure.com/openai/deployments/')).toBe(true);
    expect(url).toContain('api-version=2025-04-01-preview');
    expect((init.headers as Record<string, string>)['api-key']).toBe('audio-key');
  });

  it('caps the transcript at 500 chars so it fits the chat DTO', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: 'a'.repeat(900) })));
    const { text } = await new TranscriptionService(config(FULL_ENV)).transcribe(file(webm()));
    expect(text).toHaveLength(500);
  });

  it('503 when Azure fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(new TranscriptionService(config(FULL_ENV)).transcribe(file(webm()))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects oversized audio even if the pipe was bypassed', async () => {
    await expect(
      new TranscriptionService(config(FULL_ENV)).transcribe(file(webm(MAX_AUDIO_BYTES + 1))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('transcribe upload pipe (mime / size / magic bytes)', () => {
  it('accepts a real webm voice note with codec parameters', async () => {
    const f = file(webm());
    await expect(pipe().transform(f)).resolves.toBe(f);
  });

  it('rejects files over 1 MB', async () => {
    await expect(pipe().transform(file(webm(MAX_AUDIO_BYTES + 1)))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-audio declared mime type even with audio bytes', async () => {
    await expect(pipe().transform(file(webm(), 'application/pdf'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects HTML renamed as audio/mpeg', async () => {
    const html = Buffer.from('<!DOCTYPE html><script>alert(1)</script>');
    await expect(pipe().transform(file(html, 'audio/mpeg'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing file', async () => {
    await expect(pipe().transform(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('sniffAudioContainer', () => {
  const pad = (head: number[] | string) => {
    const b = Buffer.alloc(32);
    if (typeof head === 'string') b.write(head, 0, 'latin1');
    else b.set(head, 0);
    return new Uint8Array(b);
  };

  it.each([
    ['webm', pad([0x1a, 0x45, 0xdf, 0xa3])],
    ['ogg', pad('OggS')],
    ['mp4', pad('\x00\x00\x00\x20ftypM4A ')],
    ['wav', pad('RIFF\x00\x00\x00\x00WAVE')],
    ['mp3', pad('ID3')],
    ['mp3', pad([0xff, 0xfb, 0x90])],
  ])('detects %s', (expected, bytes) => {
    expect(sniffAudioContainer(bytes)).toBe(expected);
  });

  it('returns null for unknown or too-short content', () => {
    expect(sniffAudioContainer(pad('%PDF-1.7'))).toBeNull();
    expect(sniffAudioContainer(new Uint8Array([0x1a, 0x45]))).toBeNull();
  });
});
