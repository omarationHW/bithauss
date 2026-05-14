import { Module } from '@nestjs/common';
import { BrcController } from './brc.controller';
import { BrcService } from './brc.service';

@Module({
  controllers: [BrcController],
  providers: [BrcService],
})
export class BrcModule {}
