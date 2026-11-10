import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { MAX_AUDIO_BYTES } from './assistant.constants';
import { ChatRequestDto, type ChatResponse, type TranscribeResponse } from './assistant.dto';
import { AssistantService } from './assistant.service';
import { AudioFileValidator } from './audio-file.validator';
import { TranscriptionService } from './transcription.service';

/**
 * Public conversational property search. Anonymous and paid per call (LLM +
 * transcription), so both routes are throttled far below the global 60/min.
 */
@Public()
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly transcription: TranscriptionService,
  ) {}

  /** POST /api/v1/assistant/chat */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatRequestDto): Promise<ChatResponse> {
    return this.assistant.chat(dto.messages);
  }

  /**
   * POST /api/v1/assistant/transcribe — multipart field `audio`.
   *
   * multer's `fileSize` limit aborts an oversized body while streaming (413)
   * instead of buffering it; the pipe then re-checks size and decides the
   * container from the bytes.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } }))
  async transcribe(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AUDIO_BYTES }),
          new AudioFileValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<TranscribeResponse> {
    return this.transcription.transcribe(file);
  }
}
