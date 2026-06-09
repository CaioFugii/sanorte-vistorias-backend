import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { getRequestContext } from '../logging/request.utils';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const requestContext = getRequestContext(request);
    const start = Date.now();

    this.logger.log('Incoming request', requestContext);

    return next.handle().pipe(
      tap(() => {
        this.logger.log('Request completed', {
          ...requestContext,
          statusCode: response.statusCode,
          durationMs: Date.now() - start,
        });
      }),
      catchError((error: unknown) => {
        this.logger.error('Request failed', (error as Error)?.stack, {
          ...requestContext,
          statusCode: response.statusCode,
          durationMs: Date.now() - start,
        });
        return throwError(() => error);
      }),
    );
  }
}
