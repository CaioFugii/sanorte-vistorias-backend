import { DashboardsService } from './dashboards.service';
import { InspectionStatus, ModuleType } from '../common/enums';

function createMockQueryBuilder({
  rawOne,
  rawMany,
}: {
  rawOne?: any;
  rawMany?: any[];
}) {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawOne ?? null),
    getRawMany: jest.fn().mockResolvedValue(rawMany ?? []),
  };
}

describe('DashboardsService', () => {
  let service: DashboardsService;
  let inspectionsRepository: any;
  let teamRepository: any;

  beforeEach(() => {
    inspectionsRepository = {
      createQueryBuilder: jest.fn(),
    };

    teamRepository = {
      findOne: jest.fn(),
    };

    service = new DashboardsService(
      inspectionsRepository as any,
      teamRepository as any,
    );
  });

  it('deve agregar série mensal por serviço e calcular crescimento', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          month: '2025-10',
          serviceLabel: 'ESGOTO',
          qualityPercent: '34.9',
          inspectionsCount: '141',
        },
        {
          month: '2025-11',
          serviceLabel: 'ESGOTO',
          qualityPercent: '57.9',
          inspectionsCount: '158',
        },
        {
          month: '2025-11',
          serviceLabel: 'ÁGUA',
          qualityPercent: '80.0',
          inspectionsCount: '20',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityByService({
      from: '2025-08-01',
      to: '2025-11-30',
    });

    expect(result.period).toEqual(['2025-08', '2025-09', '2025-10', '2025-11']);
    expect(result.services).toHaveLength(2);

    const esgoto = result.services.find((serviceItem) =>
      serviceItem.serviceLabel === 'ESGOTO');
    expect(esgoto).toBeDefined();
    expect(esgoto?.serviceKey).toBe('esgoto');
    expect(esgoto?.series).toEqual([
      { month: '2025-08', qualityPercent: 0, inspectionsCount: 0 },
      { month: '2025-09', qualityPercent: 0, inspectionsCount: 0 },
      { month: '2025-10', qualityPercent: 34.9, inspectionsCount: 141 },
      { month: '2025-11', qualityPercent: 57.9, inspectionsCount: 158 },
    ]);
    expect(esgoto?.growth).toEqual({
      fromMonth: '2025-10',
      toMonth: '2025-11',
      growthPercent: 65.9,
      deltaPoints: 23,
    });
  });

  it('deve aplicar filtros de module e teamId nas consultas de qualidade', async () => {
    const qb = createMockQueryBuilder({});
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getQualityByService({
      from: '2025-01-01',
      to: '2025-01-31',
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.CAMPO,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });
  });

  it('deve retornar mês vigente por serviço com KPIs e ranking', async () => {
    const summaryQb = createMockQueryBuilder({
      rawOne: {
        averagePercent: '71.1',
        inspectionsCount: '1547',
        pendingAdjustmentsCount: '65',
      },
    });
    const rankingQb = createMockQueryBuilder({
      rawMany: [
        {
          serviceLabel: 'CAVALETE / HM',
          ownerLabel: '',
          qualityPercent: '83.1',
          inspectionsCount: '328',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(summaryQb)
      .mockReturnValueOnce(rankingQb);

    const result = await service.getCurrentMonthByService({
      month: '2025-12',
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });

    expect(result.month).toBe('2025-12');
    expect(result.summary).toEqual({
      averagePercent: 71.1,
      inspectionsCount: 1547,
      pendingAdjustmentsCount: 65,
    });
    expect(result.services).toEqual([
      {
        serviceKey: 'cavalete_hm',
        serviceLabel: 'CAVALETE / HM',
        ownerLabel: null,
        qualityPercent: 83.1,
        inspectionsCount: 328,
      },
    ]);

    expect(summaryQb.andWhere).toHaveBeenCalledWith(
      'inspection.module = :module',
      {
        module: ModuleType.CAMPO,
      },
    );
    expect(summaryQb.andWhere).toHaveBeenCalledWith(
      'inspection.teamId = :teamId',
      {
        teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      },
    );
    expect(rankingQb.andWhere).toHaveBeenCalledWith(
      'inspection.module = :module',
      {
        module: ModuleType.CAMPO,
      },
    );
    expect(rankingQb.andWhere).toHaveBeenCalledWith(
      'inspection.teamId = :teamId',
      {
        teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      },
    );
    expect(summaryQb.where).toHaveBeenCalledWith(
      'inspection.status IN (:...qualityStatuses)',
      {
        qualityStatuses: [
          InspectionStatus.FINALIZADA,
          InspectionStatus.PENDENTE_AJUSTE,
          InspectionStatus.RESOLVIDA,
        ],
      },
    );
  });
});
