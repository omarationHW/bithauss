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
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
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
}
