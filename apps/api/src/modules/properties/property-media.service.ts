import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  Length,
} from 'class-validator';

import {
  MAX_PROPERTY_VIDEOS,
  MAX_VIDEO_FILE_BYTES,
  parseVideoUrl,
  sniffVideoMime,
  fileExtension,
  ACCEPTED_VIDEO_MIME_TYPES,
} from '@bithauss/validators';

import { SupabaseConfigService } from '../../config/supabase.config';

/** PUBLIC bucket created in migration 030. */
export const PROPERTY_VIDEO_BUCKET = 'property-videos';

// ────────────────────────────────────────────────────────────
// DTOs
// ────────────────────────────────────────────────────────────

export class AttachExternalVideoDto {
  /** Only the two providers we can safely embed. */
  @IsString() @IsIn(['YOUTUBE', 'VIMEO']) provider!: string;

  /**
   * The URL the publisher pasted. It is NEVER stored as-is: the service
   * re-parses it against the host allowlist and persists the canonical URL it
   * rebuilds from the extracted id.
   */
  @IsString() @Length(1, 2048) url!: string;

  @IsOptional() @IsString() @Length(0, 300) alt_text?: string;
}

export class ReorderMediaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(64)
  @IsUUID('4', { each: true })
  media_ids!: string[];
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * Video/media endpoints for a listing.
 *
 * Every method starts from `verifyOwnership`. The service holds the
 * service_role client, which bypasses RLS — so the ownership check IS the
 * authorisation here, and skipping it on any path would be a plain IDOR
 * (any authenticated user attaching or deleting media on someone else's
 * listing). The property id from the route is also used to scope the media
 * lookups, so a valid media id from another property cannot be deleted
 * through a property the caller does own.
 */
@Injectable()
export class PropertyMediaService {
  private readonly logger = new Logger(PropertyMediaService.name);

  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  private async verifyOwnership(propertyId: string, ownerId: string) {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('properties')
      .select('id, owner_id')
      .eq('id', propertyId)
      .single();

    if (error || !data) {
      this.logger.warn(`Property not found: ${propertyId}`);
      throw new NotFoundException('Property not found');
    }

    if (data.owner_id !== ownerId) {
      this.logger.warn(
        `User ${ownerId} tried to modify media of property ${propertyId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to modify this property',
      );
    }

    return data;
  }

  /** Current VIDEO rows, ordered as the ficha renders them. */
  async listVideos(propertyId: string, ownerId: string) {
    await this.verifyOwnership(propertyId, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('property_media')
      .select('*')
      .eq('property_id', propertyId)
      .eq('media_type', 'VIDEO')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  private async assertRoomForVideo(propertyId: string) {
    const supabase = this.supabaseConfig.getAdminClient();
    const { count, error } = await supabase
      .from('property_media')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('media_type', 'VIDEO');

    if (error) throw error;

    if ((count ?? 0) >= MAX_PROPERTY_VIDEOS) {
      throw new BadRequestException(
        `Solo puedes agregar ${MAX_PROPERTY_VIDEOS} videos por propiedad.`,
      );
    }

    return count ?? 0;
  }

  /** Next free sort_order, so videos land after the photos. */
  private async nextSortOrder(propertyId: string): Promise<number> {
    const supabase = this.supabaseConfig.getAdminClient();
    const { data } = await supabase
      .from('property_media')
      .select('sort_order')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const highest = data?.[0]?.sort_order;
    return typeof highest === 'number' ? highest + 1 : 0;
  }

  /**
   * Attaches a YouTube/Vimeo video.
   *
   * The stored `url` is rebuilt from the parsed id, so a hostile input
   * (`javascript:`, `youtube.com.evil.tld`, a URL with credentials) can never
   * reach the <iframe src> on the public page — it is rejected here.
   */
  async attachExternalVideo(
    propertyId: string,
    ownerId: string,
    dto: AttachExternalVideoDto,
  ) {
    await this.verifyOwnership(propertyId, ownerId);
    const existing = await this.assertRoomForVideo(propertyId);

    const parsed = parseVideoUrl(dto.url);
    if (!parsed || parsed.provider !== dto.provider) {
      throw new BadRequestException(
        'La liga del video debe ser de YouTube o Vimeo.',
      );
    }

    const supabase = this.supabaseConfig.getAdminClient();
    const { data, error } = await supabase
      .from('property_media')
      .insert({
        property_id: propertyId,
        url: parsed.canonicalUrl,
        media_type: 'VIDEO',
        provider: parsed.provider,
        external_id: parsed.externalId,
        thumbnail_url: parsed.thumbnailUrl,
        alt_text: dto.alt_text ?? null,
        sort_order: await this.nextSortOrder(propertyId),
        is_primary: existing === 0,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to attach video: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Stores an uploaded video file and registers it as media.
   *
   * The magic-byte check runs again here even though the controller's
   * ParseFilePipe already ran it: the pipe protects the HTTP route, this
   * protects the method, and any future caller (a bulk importer, a job) gets
   * the same guarantee.
   */
  async uploadVideo(
    propertyId: string,
    ownerId: string,
    file: Express.Multer.File,
  ) {
    await this.verifyOwnership(propertyId, ownerId);
    const existing = await this.assertRoomForVideo(propertyId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('El archivo de video está vacío.');
    }

    if (file.size > MAX_VIDEO_FILE_BYTES) {
      throw new BadRequestException(
        `El video excede el máximo de ${Math.round(
          MAX_VIDEO_FILE_BYTES / (1024 * 1024),
        )} MB.`,
      );
    }

    const detected = sniffVideoMime(new Uint8Array(file.buffer.subarray(0, 16)));
    if (
      !detected ||
      !(ACCEPTED_VIDEO_MIME_TYPES as readonly string[]).includes(detected)
    ) {
      // The extension and the multipart content-type are both attacker
      // controlled; the bytes are not.
      throw new BadRequestException(
        'El archivo no es un video MP4, WebM o MOV válido.',
      );
    }

    const supabase = this.supabaseConfig.getAdminClient();
    const ext = fileExtension(file.originalname ?? '') || 'mp4';
    // Same key layout the browser uploader uses, so the Storage policy
    // (first folder = uid) stays the single rule for both paths.
    const path = `${ownerId}/${propertyId}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(PROPERTY_VIDEO_BUCKET)
      .upload(path, file.buffer, {
        cacheControl: '3600',
        upsert: false,
        // The DETECTED type, never file.mimetype.
        contentType: detected,
      });

    if (uploadError) {
      this.logger.error(`Failed to upload video: ${uploadError.message}`);
      throw new BadRequestException('No se pudo subir el video.');
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(PROPERTY_VIDEO_BUCKET).getPublicUrl(path);

    const { data, error } = await supabase
      .from('property_media')
      .insert({
        property_id: propertyId,
        url: publicUrl,
        media_type: 'VIDEO',
        provider: 'UPLOAD',
        external_id: null,
        thumbnail_url: null,
        alt_text: file.originalname ?? null,
        sort_order: await this.nextSortOrder(propertyId),
        is_primary: existing === 0,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to register video media: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Deletes one media row (and its storage object when we host it).
   *
   * Scoped by `property_id` as well as `id`: without it, a caller who owns
   * property A could delete media belonging to property B by passing B's
   * media id on A's route.
   */
  async removeMedia(propertyId: string, mediaId: string, ownerId: string) {
    await this.verifyOwnership(propertyId, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();

    const { data: media, error: findError } = await supabase
      .from('property_media')
      .select('id, url, provider, media_type')
      .eq('id', mediaId)
      .eq('property_id', propertyId)
      .single();

    if (findError || !media) {
      throw new NotFoundException('Media not found');
    }

    if (media.provider === 'UPLOAD') {
      const marker = `/storage/v1/object/public/${PROPERTY_VIDEO_BUCKET}/`;
      const idx = String(media.url).indexOf(marker);
      if (idx !== -1) {
        const objectPath = decodeURIComponent(
          String(media.url).slice(idx + marker.length),
        );
        // Best effort: an orphaned object is cheaper than a failed delete.
        const { error: removeError } = await supabase.storage
          .from(PROPERTY_VIDEO_BUCKET)
          .remove([objectPath]);
        if (removeError) {
          this.logger.warn(
            `Could not remove storage object ${objectPath}: ${removeError.message}`,
          );
        }
      }
    }

    const { error } = await supabase
      .from('property_media')
      .delete()
      .eq('id', mediaId)
      .eq('property_id', propertyId);

    if (error) throw error;

    return { id: mediaId, deleted: true };
  }

  /**
   * Rewrites `sort_order` to match the given id order.
   *
   * Every id must belong to this property — otherwise the endpoint would let
   * a caller renumber (and therefore probe the existence of) rows of listings
   * they do not own.
   */
  async reorderMedia(propertyId: string, ownerId: string, dto: ReorderMediaDto) {
    await this.verifyOwnership(propertyId, ownerId);

    const supabase = this.supabaseConfig.getAdminClient();

    const { data: rows, error: findError } = await supabase
      .from('property_media')
      .select('id, media_type')
      .eq('property_id', propertyId);

    if (findError) throw findError;

    const owned = new Set((rows ?? []).map((row) => row.id as string));
    const unknown = dto.media_ids.filter((id) => !owned.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        'Uno o más elementos no pertenecen a esta propiedad.',
      );
    }

    const typeById = new Map(
      (rows ?? []).map((row) => [row.id as string, row.media_type as string]),
    );

    // Clear every flag first. `uniq_property_media_primary` allows a single
    // primary per (property, media_type), so promoting a new one before
    // demoting the old one would hit the unique index mid-loop.
    const { error: clearError } = await supabase
      .from('property_media')
      .update({ is_primary: false })
      .eq('property_id', propertyId);

    if (clearError) throw clearError;

    // The first id of each media_type becomes that type's primary — a mixed
    // list keeps one cover photo AND one main video.
    const seenTypes = new Set<string>();

    for (let i = 0; i < dto.media_ids.length; i++) {
      const id = dto.media_ids[i] as string;
      const mediaType = typeById.get(id) ?? 'IMAGE';
      const isPrimary = !seenTypes.has(mediaType);
      seenTypes.add(mediaType);

      const { error } = await supabase
        .from('property_media')
        .update({ sort_order: i, is_primary: isPrimary })
        .eq('id', id)
        .eq('property_id', propertyId);

      if (error) throw error;
    }

    return this.listVideos(propertyId, ownerId);
  }
}
