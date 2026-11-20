import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessArea } from '../common/enums';
import { InvestmentWorkSummaryService } from './investment-work-summary.service';
import { InvestmentWorksController } from './investment-works.controller';
import { InvestmentWorksService } from './investment-works.service';

class HeaderUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const rawAreas = req.headers['x-areas'];
    req.user = {
      role: req.headers['x-role'] ?? 'GESTOR',
      areas: typeof rawAreas === 'string' ? rawAreas.split(',').filter(Boolean) : [],
    };
    return true;
  }
}

describe('InvestmentWorksController summary', () => {
  let app: INestApplication;
  const summary = {
    field: {
      period: { from: '2026-11-01', to: '2026-11-30' },
      goal: 12,
      done: 4,
    },
    postWork: {
      period: { from: '2026-10-01', to: '2026-10-31' },
      goal: 3,
      done: 1,
    },
  };
  const findOne = jest.fn();
  const summarize = jest.fn().mockResolvedValue(summary);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvestmentWorksController],
      providers: [
        {
          provide: InvestmentWorksService,
          useValue: { findOne, findAll: jest.fn() },
        },
        {
          provide: InvestmentWorkSummaryService,
          useValue: { summarize },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderUserGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa quem não tem Painel e Obras Inv juntos', async () => {
    await request(app.getHttpServer())
      .get('/investment-works/summary')
      .set('x-role', 'GESTOR')
      .set('x-areas', AccessArea.QUALIDADE_PAINEL)
      .expect(403);

    await request(app.getHttpServer())
      .get('/investment-works/summary')
      .set('x-role', 'GESTOR')
      .set('x-areas', AccessArea.ENGENHARIA_OBRAS)
      .expect(403);
  });

  it('devolve as duas caixas e não trata summary como id', async () => {
    await request(app.getHttpServer())
      .get('/investment-works/summary')
      .set('x-role', 'GESTOR')
      .set('x-areas', `${AccessArea.QUALIDADE_PAINEL},${AccessArea.ENGENHARIA_OBRAS}`)
      .expect(200)
      .expect(summary);

    expect(findOne).not.toHaveBeenCalled();
    expect(summarize).toHaveBeenCalled();
  });
});
