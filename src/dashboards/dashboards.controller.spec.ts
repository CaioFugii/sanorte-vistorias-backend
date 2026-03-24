import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

class HeaderDrivenJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { role: req.headers['x-role'] ?? 'FISCAL' };
    return true;
  }
}

describe('DashboardsController (integration)', () => {
  let app: INestApplication;

  const dashboardsServiceMock = {
    getSummary: jest.fn().mockResolvedValue({
      averagePercent: 70,
      inspectionsCount: 10,
      pendingCount: 1,
    }),
    getTeamsRanking: jest.fn().mockResolvedValue([]),
    getTeamPerformance: jest.fn().mockResolvedValue({
      teamId: 'team-id',
      teamName: 'Equipe',
      averagePercent: 70,
      inspectionsCount: 10,
      pendingCount: 1,
      paralyzedCount: 0,
      paralysisRatePercent: 0,
    }),
    getQualityByService: jest.fn().mockResolvedValue({
      period: ['2025-11'],
      services: [],
    }),
    getCurrentMonthByService: jest.fn().mockResolvedValue({
      month: '2025-11',
      summary: {
        averagePercent: 70,
        inspectionsCount: 10,
        pendingAdjustmentsCount: 1,
      },
      services: [],
    }),
    getLowScoreCollaborators: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      lowScoreThreshold: 70,
      collaborators: [],
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardsController],
      providers: [
        RolesGuard,
        {
          provide: DashboardsService,
          useValue: dashboardsServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new HeaderDrivenJwtGuard())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve bloquear FISCAL no endpoint de analytics', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/quality-by-service')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'FISCAL')
      .expect(403);
  });

  it('deve permitir ADMIN no endpoint de analytics', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/quality-by-service')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve permitir GESTOR no endpoint de analytics', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/current-month-by-service')
      .query({ month: '2025-11' })
      .set('x-role', 'GESTOR')
      .expect(200);
  });

  it('deve permitir ADMIN no endpoint de colaboradores com notas ruins', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/safety-work/low-score-collaborators')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'ADMIN')
      .expect(200);
  });
});
