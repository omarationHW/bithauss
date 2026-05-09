import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { OcrService, EscrituraCrossCheckInput } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  // OCR is expensive (Azure DocIntelligence + OpenAI per call). Tighter throttle.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 }), // 15MB (was 50MB)
          new FileTypeValidator({ fileType: /(pdf|jpeg|jpg|png)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('documentSlug') documentSlug: string | undefined,
    @Body('documentName') documentName: string | undefined,
  ) {
    // Accept either slug or name
    const slug = documentSlug || (documentName ? OcrService.nameToSlug(documentName) : null);

    if (!slug) {
      throw new BadRequestException('documentSlug or documentName is required');
    }

    return this.ocrService.validateDocument(file, slug);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('cross-check-escritura')
  crossCheckEscritura(@Body() payload: EscrituraCrossCheckInput) {
    if (!payload || !payload.escritura) {
      throw new BadRequestException('escritura es obligatoria en el payload');
    }
    return this.ocrService.crossCheckEscritura(payload);
  }
}
