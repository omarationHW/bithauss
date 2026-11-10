import { Module } from '@nestjs/common';

import { PropertiesModule } from '../properties/properties.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { GeocodingService } from './geocoding.service';
import { TranscriptionService } from './transcription.service';

@Module({
  imports: [PropertiesModule],
  controllers: [AssistantController],
  providers: [AssistantService, GeocodingService, TranscriptionService],
})
export class AssistantModule {}
