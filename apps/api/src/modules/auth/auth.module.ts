import { Module, Global } from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';

/**
 * Auth module - provides Supabase authentication services globally.
 * The SupabaseConfigService is exported so that AuthGuard and other
 * modules can inject it for JWT validation and database access.
 */
@Global()
@Module({
  providers: [SupabaseConfigService],
  exports: [SupabaseConfigService],
})
export class AuthModule {}
