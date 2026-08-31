import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { AdminModule } from './modules/admin/admin.module';
import { BrcModule } from './modules/brc/brc.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // Global configuration from environment variables
    // A missing secret must stop the process at boot, not silently degrade a
    // request months later: the BRC verification endpoint used to fall back to
    // a hardcoded secret, and the deploy shipped without the service-role key.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),

    // Rate limiting: 60 requests per 60 seconds per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Feature modules
    HealthModule,
    AuthModule,
    ProfilesModule,
    PropertiesModule,
    OcrModule,
    AdminModule,
    BrcModule,
    PaymentsModule,
    MembershipsModule,
  ],
  providers: [
    // Global throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global auth guard - all routes require auth unless marked @Public()
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // Global roles guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global exception filter — normalizes errors + forwards 5xx to Sentry
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Audit trail for mutating operations. It existed but was never registered,
    // so nothing was ever written to audit_logs.
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
