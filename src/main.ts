import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { initSentry } from './common/monitoring/sentry';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const sentryInitialized = initSentry();
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  if (sentryInitialized) {
    logger.log('Sentry monitoring enabled');
  }
}
bootstrap();
