import { Module } from '@nestjs/common';

import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

/**
 * Módulo de Membresías (Módulo Membresías 2024 · 2026 V1).
 *
 * NOTE: not wired into AppModule here on purpose — the integration owner
 * registers it, to keep parallel work from colliding in app.module.ts.
 */
@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
