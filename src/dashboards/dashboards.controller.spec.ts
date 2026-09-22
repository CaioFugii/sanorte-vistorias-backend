import {
  INestApplication,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QualityRankingExcelExporter } from './quality-ranking-excel.exporter';
import { ExcelService } from '../excel/excel.service';

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
    getSafetyWorkChecklistInspections: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      checklistId: '11111111-1111-4111-8111-111111111111',
      checklistName: 'Vistoria de Canteiro',
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
      inspections: [],
    }),
    getSafetyWorkSummary: jest.fn().mockResolvedValue({
      averagePercent: 70,
      inspectionsCount: 10,
      pendingCount: 1,
      checklists: [],
    }),
    getTeamsRanking: jest.fn().mockResolvedValue([]),
    getSafetyWorkTeamsRanking: jest.fn().mockResolvedValue([]),
    getTeamRankingInspections: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      teamId: 'team-id',
      teamName: 'Equipe',
      metric: 'average',
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
      inspections: [],
    }),
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
    getSafetyWorkInspectorsProduction: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      days: [],
      inspectors: [],
    }),
    getTopNonConformitiesByChecklist: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      limitPerChecklist: 5,
      checklists: [],
    }),
    getTopNonConformitiesByTeam: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      teamId: 'team-id',
      limit: 10,
      checklists: [],
    }),
    getTeamPerformanceByTeams: jest.fn().mockResolvedValue({
      from: '2025-11-01',
      to: '2025-11-30',
      teamIds: [],
      summary: {},
      teams: [],
    }),
    getOverview: jest.fn().mockResolvedValue({
      from: '2026-06-01',
      to: '2026-09-19',
      quality: { averagePercent: 80, inspectionsCount: 10, months: [] },
      safetyWork: { averagePercent: 90, inspectionsCount: 5, months: [] },
    }),
  };

  const qualityRankingExcelExporterMock = {
    export: jest.fn().mockResolvedValue({
      filename: 'ranking-qualidade-2026-09-04.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('xlsx'),
    }),
  };

  const excelServiceMock = {
    attachToResponse: jest.fn().mockReturnValue({}),
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
        {
          provide: QualityRankingExcelExporter,
          useValue: qualityRankingExcelExporterMock,
        },
        {
          provide: ExcelService,
          useValue: excelServiceMock,
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

  it('deve permitir ADMIN no endpoint de qualidade separado', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/quality/quality-by-service')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve permitir ADMIN no detalhamento de vistorias por checklist de segurança', async () => {
    await request(app.getHttpServer())
      .get(
        '/dashboards/safety-work/checklists/11111111-1111-4111-8111-111111111111/inspections',
      )
      .query({
        from: '2025-11-01',
        to: '2025-11-30',
        page: 1,
        limit: 20,
      })
      .set('x-role', 'ADMIN')
      .expect(200);

    expect(
      dashboardsServiceMock.getSafetyWorkChecklistInspections,
    ).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        user: { role: 'ADMIN' },
        from: '2025-11-01',
        to: '2025-11-30',
      }),
    );
  });

  it('deve permitir ADMIN no endpoint de segurança do trabalho separado', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/safety-work/summary')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve permitir GESTOR no overview da Gestão', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/overview')
      .query({ from: '2026-06-01', to: '2026-09-19' })
      .set('x-role', 'GESTOR')
      .expect(200);
  });

  it('deve permitir GESTOR no endpoint de analytics', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/current-month-by-service')
      .query({ month: '2025-11' })
      .set('x-role', 'GESTOR')
      .expect(200);
  });

  it('deve permitir ADMIN no endpoint de detalhamento de vistorias do ranking', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/ranking/teams/team-id/inspections')
      .query({
        from: '2025-11-01',
        to: '2025-11-30',
        metric: 'field',
        page: 1,
        limit: 20,
      })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve permitir ADMIN no endpoint de exportação do ranking de qualidade', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/quality/ranking/teams/export')
      .query({
        from: '2026-09-01',
        to: '2026-09-04',
      })
      .set('x-role', 'ADMIN')
      .expect(200);

    expect(qualityRankingExcelExporterMock.export).toHaveBeenCalled();
  });

  it('deve permitir ADMIN no novo endpoint de ranking safety work', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/ranking/teams/safety-work')
      .query({
        from: '2025-11-01',
        to: '2025-11-30',
      })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve permitir ADMIN no endpoint de colaboradores com notas ruins', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/safety-work/low-score-collaborators')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve permitir ADMIN no endpoint de produção diária de fiscais de ST', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/safety-work/inspectors-production')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'ADMIN')
      .expect(200);
  });

  it('deve bloquear FISCAL no endpoint de produção diária de fiscais de ST', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/safety-work/inspectors-production')
      .query({ from: '2025-11-01', to: '2025-11-30' })
      .set('x-role', 'FISCAL')
      .expect(403);
  });

  it('deve permitir GESTOR no endpoint de não conformidades por checklist', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/non-conformities/by-checklist')
      .query({ from: '2025-11-01', to: '2025-11-30', limitPerChecklist: 3 })
      .set('x-role', 'GESTOR')
      .expect(200);
  });

  it('deve permitir ADMIN no endpoint de não conformidades por equipe', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/non-conformities/by-team')
      .query({
        from: '2025-11-01',
        to: '2025-11-30',
        teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
        limit: 5,
      })
      .set('x-role', 'ADMIN')
      .expect(200);
  });
});
