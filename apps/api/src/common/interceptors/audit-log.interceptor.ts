import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

interface AuditRecord {
  ts: string;
  method: string;
  path: string;
  userId: string;
  role: string;
  ip: string;
  ua: string;
  status: number | 'started';
  ms?: number;
}

/**
 * HTTP audit trail (BH-16).
 *
 * The database already records *what* changed (`audit_logs` triggers,
 * `brc_expediente_logs`). What was missing after an incident was the HTTP
 * layer: who called which endpoint, from where, with which effective role,
 * and — crucially — the DENIED attempts, which is the only signal that shows
 * an attack while it is still happening.
 *
 * Deliberately never logs the request body: it carries CURP, RFC, escritura
 * text and, in the payments module, customer details. The URL is logged
 * without its query string for the same reason.
 *
 * NOT YET REGISTERED — needs `{ provide: APP_INTERCEPTOR, useClass:
 * AuditLogInterceptor }` in app.module.ts.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  private readonly MUTATING_METHODS = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method: string = request.method;

    if (!this.MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const base: Omit<AuditRecord, 'status' | 'ms'> = {
      ts: new Date().toISOString(),
      method,
      path: stripQuery(String(request.url ?? '')),
      userId: request.user?.id ?? 'anonymous',
      // Set by AuthGuard from the profiles table, never from user_metadata.
      role: request.userRole ?? 'unknown',
      ip: clientIp(request),
      ua: String(request.headers?.['user-agent'] ?? '').slice(0, 200),
    };

    this.logger.log(this.format({ ...base, status: 'started' }));

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            this.format({
              ...base,
              status: response?.statusCode ?? 200,
              ms: Date.now() - startTime,
            }),
          );
        },
        error: (error: unknown) => {
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          const record = this.format({
            ...base,
            status,
            ms: Date.now() - startTime,
          });
          // 401/403 are the security-relevant ones: a burst of them from one
          // user is what an alert should fire on (docs/SECURITY.md 4.5).
          if (status === 401 || status === 403) {
            this.logger.warn(`DENIED ${record}`);
          } else {
            this.logger.warn(record);
          }
        },
      }),
    );
  }

  private format(record: AuditRecord): string {
    const parts = [
      record.ts,
      record.method,
      record.path,
      `user=${record.userId}`,
      `role=${record.role}`,
      `ip=${record.ip}`,
      `status=${record.status}`,
    ];
    if (record.ms !== undefined) parts.push(`ms=${record.ms}`);
    parts.push(`ua="${record.ua}"`);
    return parts.join(' | ');
  }
}

/** Query strings carry tokens and emails — never audit them verbatim. */
export function stripQuery(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

/**
 * Rightmost `X-Forwarded-For` entry: Azure App Service appends the real caller
 * there, so a client-supplied prefix cannot forge it. Same reasoning as
 * `apps/web/src/lib/rate-limit.ts`.
 */
export function clientIp(request: {
  headers?: Record<string, unknown>;
  ip?: string;
}): string {
  const xff = request.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.split(':')[0] ?? last;
  }
  return request.ip ?? 'unknown';
}
