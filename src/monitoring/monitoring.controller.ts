import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  InternalServerErrorException,
} from '@nestjs/common';

@Controller('monitoring')
export class MonitoringController {
  @Get('sentry-smoke-test')
  sentrySmokeTest(@Headers('x-monitoring-token') token?: string) {
    const expectedToken = process.env.MONITORING_SMOKE_TEST_TOKEN;
    if (!expectedToken) {
      throw new ForbiddenException(
        'Smoke test desabilitado: configure MONITORING_SMOKE_TEST_TOKEN',
      );
    }

    if (!token || token !== expectedToken) {
      throw new ForbiddenException('Token de monitoramento inválido');
    }

    throw new InternalServerErrorException(
      'Sentry smoke test: erro intencional para validação de monitoramento',
    );
  }
}
