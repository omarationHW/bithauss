import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Global exception filter — catches ALL thrown errors, normalizes the
 * response, and forwards 5xx to Sentry when configured.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : (exception as Error)?.message ?? 'Internal server error';

    const isProd = process.env.NODE_ENV === 'production';
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] }).message ||
          (exception as Error)?.message;

    // In production, never echo back internal request paths or methods.
    // For 5xx, return a generic message — details go to logs only.
    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message:
        isProd && status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : message,
    };
    if (!isProd) {
      errorResponse.path = request.url;
      errorResponse.method = request.method;
    }

    // Log server errors at error level, client errors at warn level.
    // Forward 5xx to Sentry when DSN is configured.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        (exception as Error)?.stack,
      );
      Sentry.withScope((scope) => {
        scope.setTag('http.method', request.method);
        scope.setTag('http.status', String(status));
        scope.setContext('request', {
          url: request.url,
          method: request.method,
          headers: { 'user-agent': request.headers['user-agent'] },
        });
        const user = (request as Request & { user?: { id?: string } }).user;
        if (user?.id) scope.setUser({ id: user.id });
        Sentry.captureException(exception);
      });
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${errorResponse.message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
