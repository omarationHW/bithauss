import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  ParseFilePipe,
  MaxFileSizeValidator,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MAX_VIDEO_FILE_BYTES } from '@bithauss/validators';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  PropertyMediaService,
  AttachExternalVideoDto,
  ReorderMediaDto,
} from './property-media.service';
import { VideoMagicBytesValidator } from './video-magic-bytes.validator';

/**
 * Media (video) endpoints of a listing.
 *
 * Deliberately NOT public: every route resolves the caller from the JWT and
 * the service checks that they own the property in the path. Reading media is
 * already public through `GET /properties/:id`, which embeds `property_media`.
 */
@Controller('properties/:propertyId/media')
export class PropertyMediaController {
  constructor(private readonly mediaService: PropertyMediaService) {}

  /** GET /api/v1/properties/:propertyId/media/videos */
  @Get('videos')
  async listVideos(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.mediaService.listVideos(propertyId, userId);
  }

  /**
   * POST /api/v1/properties/:propertyId/media/videos/link
   * Attaches a YouTube/Vimeo video by URL.
   */
  @Roles('broker', 'inmobiliaria', 'vendedor')
  @Post('videos/link')
  async attachExternal(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AttachExternalVideoDto,
  ) {
    return this.mediaService.attachExternalVideo(propertyId, userId, dto);
  }

  /**
   * POST /api/v1/properties/:propertyId/media/videos/upload
   * Uploads a video FILE (multipart field `file`).
   *
   * Two validators, in this order on purpose: the size check rejects a 2 GB
   * body before anything reads it, and the magic-byte check then decides the
   * container from the bytes rather than from the extension or the
   * client-supplied content-type.
   *
   * Throttled harder than the CRUD routes — each accepted request writes up to
   * 200 MB into a public bucket.
   */
  @Roles('broker', 'inmobiliaria', 'vendedor')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('videos/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO_FILE_BYTES }),
          new VideoMagicBytesValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.mediaService.uploadVideo(propertyId, userId, file);
  }

  /** PATCH /api/v1/properties/:propertyId/media/reorder */
  @Patch('reorder')
  async reorder(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderMediaDto,
  ) {
    return this.mediaService.reorderMedia(propertyId, userId, dto);
  }

  /** DELETE /api/v1/properties/:propertyId/media/:mediaId */
  @Delete(':mediaId')
  async remove(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.mediaService.removeMedia(propertyId, mediaId, userId);
  }
}
