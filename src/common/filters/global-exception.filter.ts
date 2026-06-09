import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { getRequestContext } from '../logging/request.utils';
import { isSentryEnabled } from '../monitoring/sentry';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestContext = getRequestContext(request);

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    const errorMessage =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { message?: unknown }).message
        : null;

    const message =
      errorMessage ??
      (exception as Error)?.message ??
      'Erro interno no processamento da requisição';

    this.logger.error('Unhandled exception', (exception as Error)?.stack, {
      ...requestContext,
      statusCode: status,
      exceptionName: (exception as Error)?.name ?? 'UnknownError',
      message,
    });

    if (isSentryEnabled() && status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.withScope((scope) => {
        scope.setTag('http.status_code', String(status));
        scope.setTag('http.method', requestContext.method);
        scope.setTag('http.path', requestContext.path);
        scope.setTag('request_id', requestContext.requestId);

        scope.setContext('request', {
          requestId: requestContext.requestId,
          method: requestContext.method,
          path: requestContext.path,
          ip: requestContext.ip,
          userAgent: requestContext.userAgent,
          statusCode: status,
        });

        if (requestContext.userId) {
          scope.setUser({
            id: requestContext.userId,
            email: requestContext.userEmail ?? undefined,
          });
        }

        scope.setLevel(status >= 500 ? 'error' : 'warning');
        scope.setFingerprint([
          requestContext.path,
          requestContext.method,
          String(status),
          (exception as Error)?.name ?? 'UnknownError',
        ]);

        const sentryException =
          exception instanceof Error
            ? exception
            : new Error(typeof message === 'string' ? message : 'Request failed');

        Sentry.captureException(sentryException);
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: requestContext.path,
      requestId: requestContext.requestId,
    });
  }
}
