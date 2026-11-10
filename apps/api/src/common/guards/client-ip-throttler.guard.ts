import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { clientIp } from '../interceptors/audit-log.interceptor';

/**
 * Rate-limits by the visitor's real IP instead of the socket address.
 *
 * On Azure App Service every request reaches Node through the platform's
 * front end, so the socket address is the same for many visitors and they'd
 * share one rate-limit bucket. The front end appends the real client IP as the
 * LAST X-Forwarded-For entry (anything earlier is client-supplied and
 * spoofable), which is exactly what `clientIp()` reads.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientIp(req as { headers?: Record<string, unknown>; ip?: string });
  }
}
