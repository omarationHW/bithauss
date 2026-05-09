import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter.
 * Catches all HttpExceptions and formats a consistent error response.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const isProd = process.env.NODE_ENV === 'production';
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] }).message ||
          exception.message;

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

    // Log server errors at error level, client errors at warn level
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${errorResponse.message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
