import 'reflect-metadata';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

import {
  PropertyMediaService,
  type AttachExternalVideoDto,
} from './property-media.service';
import { VideoMagicBytesValidator } from './video-magic-bytes.validator';
import type { SupabaseConfigService } from '../../config/supabase.config';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const OWNER = '11111111-1111-4111-8111-111111111111';
const INTRUDER = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';

/** Real ISO base media header, "ftypisom". */
function mp4Buffer(): Buffer {
  const bytes = Buffer.alloc(64);
  bytes.writeUInt32BE(0x20, 0);
  bytes.write('ftypisom', 4, 'ascii');
  return bytes;
}

/** An HTML page: the classic "rename it to .mp4" bypass. */
function htmlBuffer(): Buffer {
  return Buffer.from('<!DOCTYPE html><script>alert(1)</script>', 'utf8');
}

function multerFile(name: string, buffer: Buffer, mimetype: string) {
  return {
    originalname: name,
    mimetype,
    buffer,
    size: buffer.length,
  } as Express.Multer.File;
}

/**
 * Minimal PostgREST-shaped stub. Only the calls the service makes are
 * modelled; anything unexpected surfaces as a plain undefined and fails the
 * assertion loudly instead of silently passing.
 */
function makeSupabase(propertyRow: { id: string; owner_id: string } | null) {
  const inserted: Record<string, unknown>[] = [];
  const uploaded: { path: string; contentType?: string }[] = [];

  const client = {
    from(table: string) {
      if (table === 'properties') {
        return {
          select: () => ({
            eq: () => ({
              single: async () =>
                propertyRow
                  ? { data: propertyRow, error: null }
                  : { data: null, error: { message: 'not found' } },
            }),
          }),
        };
      }

      // property_media
      const builder: Record<string, unknown> = {};
      const chain = {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: () => ({
                eq: async () => ({ count: 0, error: null }),
              }),
            };
          }
          return {
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
              eq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          };
        },
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: 'media-1', ...row }, error: null }),
            }),
          };
        },
      };
      Object.assign(builder, chain);
      return builder as never;
    },
    storage: {
      from() {
        return {
          upload: async (path: string, _body: unknown, opts?: { contentType?: string }) => {
            uploaded.push({ path, contentType: opts?.contentType });
            return { error: null };
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://cdn.test/storage/v1/object/public/property-videos/${path}` },
          }),
          remove: async () => ({ error: null }),
        };
      },
    },
  };

  return { client, inserted, uploaded };
}

function makeService(propertyRow: { id: string; owner_id: string } | null) {
  const supabase = makeSupabase(propertyRow);
  const config = {
    getAdminClient: () => supabase.client,
  } as unknown as SupabaseConfigService;

  return { service: new PropertyMediaService(config), ...supabase };
}

/* ------------------------------------------------------------------ */
/*  IDOR                                                               */
/* ------------------------------------------------------------------ */

describe('PropertyMediaService · propiedad ajena (IDOR)', () => {
  it('rechaza subir un video a una propiedad de otro usuario', async () => {
    const { service, inserted, uploaded } = makeService({
      id: PROPERTY,
      owner_id: OWNER,
    });

    await expect(
      service.uploadVideo(
        PROPERTY,
        INTRUDER,
        multerFile('recorrido.mp4', mp4Buffer(), 'video/mp4'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Nothing must have been written: not to storage, not to the table.
    expect(uploaded).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('rechaza adjuntar una liga a una propiedad de otro usuario', async () => {
    const { service, inserted } = makeService({ id: PROPERTY, owner_id: OWNER });

    await expect(
      service.attachExternalVideo(PROPERTY, INTRUDER, {
        provider: 'YOUTUBE',
        url: 'https://youtu.be/dQw4w9WgXcQ',
      } as AttachExternalVideoDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inserted).toHaveLength(0);
  });

  it('rechaza eliminar media de una propiedad de otro usuario', async () => {
    const { service } = makeService({ id: PROPERTY, owner_id: OWNER });

    await expect(
      service.removeMedia(PROPERTY, 'media-1', INTRUDER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el dueño sí puede subir', async () => {
    const { service, inserted, uploaded } = makeService({
      id: PROPERTY,
      owner_id: OWNER,
    });

    const row = await service.uploadVideo(
      PROPERTY,
      OWNER,
      multerFile('recorrido.mp4', mp4Buffer(), 'video/mp4'),
    );

    expect(uploaded).toHaveLength(1);
    // Key layout <owner>/<property>/<uuid>.<ext>: the Storage policy authorises
    // on the first folder, so it MUST be the uploader's uid.
    expect(uploaded[0]!.path.startsWith(`${OWNER}/${PROPERTY}/`)).toBe(true);
    // Stored with the DETECTED type, not the multipart one.
    expect(uploaded[0]!.contentType).toBe('video/mp4');
    expect(inserted[0]).toMatchObject({
      media_type: 'VIDEO',
      provider: 'UPLOAD',
      property_id: PROPERTY,
    });
    expect(row).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Magic bytes                                                        */
/* ------------------------------------------------------------------ */

describe('PropertyMediaService · magic bytes', () => {
  it('rechaza un archivo cuya extensión y content-type mienten', async () => {
    const { service, uploaded, inserted } = makeService({
      id: PROPERTY,
      owner_id: OWNER,
    });

    await expect(
      service.uploadVideo(
        PROPERTY,
        OWNER,
        // .mp4 + video/mp4 in the multipart headers, HTML in the bytes.
        multerFile('tour.mp4', htmlBuffer(), 'video/mp4'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A public bucket must never receive a file we could not identify.
    expect(uploaded).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('el validador del pipe aplica la misma regla', () => {
    const validator = new VideoMagicBytesValidator();

    expect(
      validator.isValid(multerFile('tour.mp4', htmlBuffer(), 'video/mp4')),
    ).toBe(false);
    expect(
      validator.isValid(multerFile('tour.mp4', mp4Buffer(), 'video/mp4')),
    ).toBe(true);
    expect(validator.isValid(undefined)).toBe(false);
    expect(validator.buildErrorMessage()).toMatch(/MP4, WebM o MOV/);
  });
});

/* ------------------------------------------------------------------ */
/*  URL allowlist                                                      */
/* ------------------------------------------------------------------ */

describe('PropertyMediaService · ligas externas', () => {
  it.each([
    'javascript:alert(1)',
    'https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ',
    'https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ',
    'data:text/html,<script>alert(1)</script>',
  ])('rechaza la liga maliciosa %s', async (url) => {
    const { service, inserted } = makeService({ id: PROPERTY, owner_id: OWNER });

    await expect(
      service.attachExternalVideo(PROPERTY, OWNER, {
        provider: 'YOUTUBE',
        url,
      } as AttachExternalVideoDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inserted).toHaveLength(0);
  });

  it('guarda la URL canónica, no la que pegó el usuario', async () => {
    const { service, inserted } = makeService({ id: PROPERTY, owner_id: OWNER });

    await service.attachExternalVideo(PROPERTY, OWNER, {
      provider: 'YOUTUBE',
      url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL666&si=track',
    } as AttachExternalVideoDto);

    expect(inserted[0]).toMatchObject({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'YOUTUBE',
      external_id: 'dQw4w9WgXcQ',
      media_type: 'VIDEO',
    });
  });

  it('rechaza cuando el proveedor declarado no coincide con la liga', async () => {
    const { service } = makeService({ id: PROPERTY, owner_id: OWNER });

    await expect(
      service.attachExternalVideo(PROPERTY, OWNER, {
        provider: 'VIMEO',
        url: 'https://youtu.be/dQw4w9WgXcQ',
      } as AttachExternalVideoDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
