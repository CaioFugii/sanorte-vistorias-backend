import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { initSentry } from './common/monitoring/sentry';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const sentryInitialized = initSentry();
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(helmet());
  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins') || [],
    credentials: false,
  });
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(
    `CORS origins: ${(configService.get<string[]>('app.corsOrigins') || []).join(', ')}`,
  );
  if (sentryInitialized) {
    logger.log('Sentry monitoring enabled');
  }
}
bootstrap();
