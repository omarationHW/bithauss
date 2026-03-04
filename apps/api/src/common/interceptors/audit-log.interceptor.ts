import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Logs mutating HTTP operations (POST, PUT, PATCH, DELETE)
 * with user information for audit trail purposes.
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

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Only log mutating operations
    if (!this.MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const userId = request.user?.id || 'anonymous';
    const timestamp = new Date().toISOString();

    this.logger.log(
      `[${timestamp}] ${method} ${url} | User: ${userId} | Started`,
    );

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${timestamp}] ${method} ${url} | User: ${userId} | Completed in ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `[${timestamp}] ${method} ${url} | User: ${userId} | Failed in ${duration}ms | Error: ${error.message}`,
          );
        },
      }),
    );
  }
}
