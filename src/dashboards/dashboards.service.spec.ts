import { DashboardsService } from './dashboards.service';
import { InspectionScope, InspectionStatus, ModuleType } from '../common/enums';
import { TeamRankingMetric } from './dto';

function createMockQueryBuilder({
  rawOne,
  rawMany,
  count,
}: {
  rawOne?: any;
  rawMany?: any[];
  count?: number;
}) {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawOne ?? null),
    getRawMany: jest.fn().mockResolvedValue(rawMany ?? []),
    getCount: jest.fn().mockResolvedValue(count ?? 0),
  };

  qb.clone = jest.fn().mockReturnValue(qb);
  return qb;
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

    const esgoto = result.services.find(
      (serviceItem) => serviceItem.serviceLabel === 'ESGOTO',
    );
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

  it('deve aplicar módulos padrão do setor de qualidade quando module não for informado', async () => {
    const qb = createMockQueryBuilder({});
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getQualityByService({
      from: '2025-01-01',
      to: '2025-01-31',
      sector: 'QUALITY' as any,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [
          ModuleType.CAMPO,
          ModuleType.POS_OBRA,
          ModuleType.REMOTO,
          ModuleType.OBRAS_INVESTIMENTO,
        ],
      },
    );
  });

  it('deve validar module incompatível com setor', async () => {
    const qb = createMockQueryBuilder({});
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.getQualityByService({
        from: '2025-01-01',
        to: '2025-01-31',
        sector: 'SAFETY_WORK' as any,
        module: ModuleType.CAMPO,
      }),
    ).rejects.toThrow('module inválido para o setor SAFETY_WORK');
  });

  it('deve aplicar filtros de module e teamId nas consultas de qualidade', async () => {
    const qb = createMockQueryBuilder({});
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getQualityByService({
      from: '2025-01-01',
      to: '2025-01-31',
      sector: 'QUALITY' as any,
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

  it('deve filtrar por contractId quando informado', async () => {
    const qb = createMockQueryBuilder({});
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const contractId = '7f214d1f-5e2a-46f8-8f90-e64129876f84';

    await service.getQualityByService({
      from: '2025-01-01',
      to: '2025-01-31',
      contractId,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('inspection.module = :dashboardSafetyModuleContract'),
      expect.objectContaining({
        dashboardSafetyModuleContract: ModuleType.SEGURANCA_TRABALHO,
        dashboardContractId: contractId,
      }),
    );
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
      sector: 'QUALITY' as any,
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

  it('deve retornar dados para gráfico de colaboradores com notas ruins em ST', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          collaboratorId: 'col-1',
          collaboratorName: 'Joao Silva',
          inspectionsCount: '5',
          badScoresCount: '3',
          averagePercent: '62.4',
          worstScorePercent: '40',
          bestScorePercent: '80',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getLowScoreCollaborators({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'SAFETY_WORK' as any,
      lowScoreThreshold: 70,
      limit: 20,
    });

    expect(result).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      lowScoreThreshold: 70,
      collaborators: [
        {
          collaboratorId: 'col-1',
          collaboratorName: 'Joao Silva',
          inspectionsCount: 5,
          badScoresCount: 3,
          badScoreRatePercent: 60,
          averagePercent: 62.4,
          worstScorePercent: 40,
          bestScorePercent: 80,
        },
      ],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.SEGURANCA_TRABALHO,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.inspectionScope = :inspectionScope',
      {
        inspectionScope: InspectionScope.COLLABORATOR,
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO],
      },
    );
    expect(qb.setParameter).toHaveBeenCalledWith('lowScoreThreshold', 70);
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('deve agrupar perguntas não conformes por checklist e limitar por checklist', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          checklistId: 'checklist-1',
          checklistName: 'Checklist Rede',
          checklistItemId: 'item-1',
          checklistItemTitle: 'Uso correto de EPI',
          nonConformitiesCount: '10',
          answersCount: '40',
        },
        {
          checklistId: 'checklist-1',
          checklistName: 'Checklist Rede',
          checklistItemId: 'item-2',
          checklistItemTitle: 'Sinalização da área',
          nonConformitiesCount: '6',
          answersCount: '30',
        },
        {
          checklistId: 'checklist-2',
          checklistName: 'Checklist Ligação',
          checklistItemId: 'item-3',
          checklistItemTitle: 'Isolamento elétrico',
          nonConformitiesCount: '8',
          answersCount: '16',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTopNonConformitiesByChecklist({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      limitPerChecklist: 1,
    });

    expect(result).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      limitPerChecklist: 1,
      checklists: [
        {
          checklistId: 'checklist-1',
          checklistName: 'Checklist Rede',
          totalNonConformities: 16,
          questions: [
            {
              checklistItemId: 'item-1',
              checklistItemTitle: 'Uso correto de EPI',
              nonConformitiesCount: 10,
              answersCount: 40,
              nonConformityRatePercent: 25,
            },
          ],
        },
        {
          checklistId: 'checklist-2',
          checklistName: 'Checklist Ligação',
          totalNonConformities: 8,
          questions: [
            {
              checklistItemId: 'item-3',
              checklistItemTitle: 'Isolamento elétrico',
              nonConformitiesCount: 8,
              answersCount: 16,
              nonConformityRatePercent: 50,
            },
          ],
        },
      ],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.CAMPO,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });
    expect(qb.setParameter).toHaveBeenCalledWith(
      'nonConformAnswer',
      'NAO_CONFORME',
    );
  });

  it('deve retornar top não conformidades por equipe', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          checklistItemId: 'item-1',
          checklistItemTitle: 'Uso correto de EPI',
          nonConformitiesCount: '10',
          answersCount: '40',
          checklistsCount: '2',
        },
        {
          checklistItemId: 'item-2',
          checklistItemTitle: 'Sinalização da área',
          nonConformitiesCount: '6',
          answersCount: '30',
          checklistsCount: '1',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTopNonConformitiesByTeam({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      limit: 2,
    });

    expect(result).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      limit: 2,
      nonConformities: [
        {
          checklistItemId: 'item-1',
          checklistItemTitle: 'Uso correto de EPI',
          nonConformitiesCount: 10,
          answersCount: 40,
          nonConformityRatePercent: 25,
          checklistsCount: 2,
        },
        {
          checklistItemId: 'item-2',
          checklistItemTitle: 'Sinalização da área',
          nonConformitiesCount: 6,
          answersCount: 30,
          nonConformityRatePercent: 20,
          checklistsCount: 1,
        },
      ],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.CAMPO,
    });
    expect(qb.setParameter).toHaveBeenCalledWith(
      'nonConformAnswer',
      'NAO_CONFORME',
    );
    expect(qb.limit).toHaveBeenCalledWith(2);
    expect(qb.addSelect).toHaveBeenCalledWith(
      'COUNT(DISTINCT inspection.checklistId)',
      'checklistsCount',
    );
  });

  it('deve retornar ranking por equipe com percentuais por módulo', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          teamId: 'team-1',
          teamName: 'Equipe Norte',
          inspectionsCount: '5',
          averagePercent: '89.44',
          postWorkPercent: '90.5',
          remotePercent: '88.2',
          fieldPercent: '91.9',
          investmentWorksPercent: '84.6',
          pendingCount: '1',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamsRanking({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
    });

    expect(result).toEqual([
      {
        teamId: 'team-1',
        teamName: 'Equipe Norte',
        averagePercent: 89.44,
        inspectionsCount: 5,
        postWorkPercent: 90.5,
        remotePercent: 88.2,
        fieldPercent: 91.9,
        investmentWorksPercent: 84.6,
        pendingCount: 1,
      },
    ]);

    expect(qb.setParameter).toHaveBeenCalledWith(
      'postWorkModule',
      ModuleType.POS_OBRA,
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'remoteModule',
      ModuleType.REMOTO,
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'fieldModule',
      ModuleType.CAMPO,
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'investmentWorksModule',
      ModuleType.OBRAS_INVESTIMENTO,
    );
  });

  it('deve usar data e contrato da inspection no summary quando module for SEGURANCA_TRABALHO', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '0',
        pendingCount: '0',
        averagePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getSummary({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'SAFETY_WORK' as any,
      module: ModuleType.SEGURANCA_TRABALHO,
      contractId: 'contract-1',
      user: {
        role: 'GESTOR',
        contracts: [{ id: 'contract-1' }, { id: 'contract-2' }],
      },
    });

    const andWhereCalls = qb.andWhere.mock.calls;
    expect(
      andWhereCalls.some(
        ([sql]: [string, any]) =>
          sql.includes('COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from'),
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql]: [string, any]) =>
          sql.includes('COALESCE(inspection.finalizedAt, inspection.createdAt) <= :to'),
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.contractId = :dashboardContractId') &&
          params?.dashboardContractId === 'contract-1',
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.contractId IN (:...allowedContractIds)') &&
          Array.isArray(params?.allowedContractIds),
      ),
    ).toBe(true);
  });

  it('deve usar regra híbrida no summary quando module não for informado', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '0',
        pendingCount: '0',
        averagePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getSummary({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      contractId: 'contract-1',
      user: {
        role: 'GESTOR',
        contracts: [{ id: 'contract-1' }, { id: 'contract-2' }],
      },
    });

    const andWhereCalls = qb.andWhere.mock.calls;
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.module = :dashboardSafetyModulePeriod') &&
          sql.includes('inspection.module != :dashboardSafetyModulePeriod') &&
          params?.dashboardSafetyModulePeriod === ModuleType.SEGURANCA_TRABALHO,
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.module = :dashboardSafetyModuleContract') &&
          sql.includes('inspection.contractId = :dashboardContractId') &&
          sql.includes('serviceOrder.contractId = :dashboardContractId') &&
          params?.dashboardSafetyModuleContract === ModuleType.SEGURANCA_TRABALHO &&
          params?.dashboardContractId === 'contract-1',
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.module = :dashboardSafetyModuleAllowedContracts') &&
          sql.includes('inspection.contractId IN (:...dashboardAllowedContractIds)') &&
          sql.includes('serviceOrder.contractId IN (:...dashboardAllowedContractIds)') &&
          params?.dashboardSafetyModuleAllowedContracts ===
            ModuleType.SEGURANCA_TRABALHO &&
          Array.isArray(params?.dashboardAllowedContractIds),
      ),
    ).toBe(true);
  });

  it('deve retornar contadores por módulo de qualidade quando includeQualityModuleCounts for true', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '14',
        pendingCount: '2',
        averagePercent: '88.5',
        fieldInspectionsCount: '5',
        fieldAveragePercent: '91.2',
        postWorkInspectionsCount: '4',
        postWorkAveragePercent: '87.3',
        remoteInspectionsCount: '3',
        remoteAveragePercent: '85.5',
        investmentWorksInspectionsCount: '2',
        investmentWorksAveragePercent: '82.1',
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSummary({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      includeQualityModuleCounts: true,
    });

    expect(result).toEqual({
      averagePercent: 88.5,
      inspectionsCount: 14,
      pendingCount: 2,
      field: {
        inspectionsCount: 5,
        averagePercent: 91.2,
      },
      postWork: {
        inspectionsCount: 4,
        averagePercent: 87.3,
      },
      remote: {
        inspectionsCount: 3,
        averagePercent: 85.5,
      },
      investmentWorks: {
        inspectionsCount: 2,
        averagePercent: 82.1,
      },
    });
  });

  it('deve usar regra híbrida de contrato em não conformidades por checklist quando module não for informado', async () => {
    const qb = createMockQueryBuilder({ rawMany: [] });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getTopNonConformitiesByChecklist({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      user: {
        role: 'GESTOR',
        contracts: [{ id: 'contract-1' }, { id: 'contract-2' }],
      },
      contractId: 'contract-1',
    });

    const andWhereCalls = qb.andWhere.mock.calls;
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.module = :dashboardSafetyModuleContract') &&
          sql.includes('inspection.contractId = :dashboardContractId') &&
          sql.includes('serviceOrder.contractId = :dashboardContractId') &&
          params?.dashboardSafetyModuleContract === ModuleType.SEGURANCA_TRABALHO,
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.module = :dashboardSafetyModuleAllowedContracts') &&
          sql.includes('inspection.contractId IN (:...dashboardAllowedContractIds)') &&
          sql.includes('serviceOrder.contractId IN (:...dashboardAllowedContractIds)') &&
          params?.dashboardSafetyModuleAllowedContracts ===
            ModuleType.SEGURANCA_TRABALHO &&
          Array.isArray(params?.dashboardAllowedContractIds),
      ),
    ).toBe(true);
  });

  it('deve retornar vistorias usadas na nota da equipe com paginação e métrica', async () => {
    teamRepository.findOne.mockResolvedValue({
      id: 'team-1',
      name: 'Equipe Norte',
    });

    const qb = createMockQueryBuilder({
      rawMany: [
        {
          inspectionId: 'insp-1',
          externalId: 'ext-insp-1',
          serviceOrderId: 'so-1',
          serviceOrderNumber: 'OS-001',
          serviceOrderAddress: 'Rua A, 123 - Centro',
          module: ModuleType.CAMPO,
          status: InspectionStatus.FINALIZADA,
          scorePercent: '97.5',
          finishedAt: new Date('2026-01-15T10:00:00.000Z'),
          createdAt: new Date('2026-01-15T09:00:00.000Z'),
        },
      ],
      count: 1,
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamRankingInspections('team-1', {
      from: '2026-01-01',
      to: '2026-01-31',
      metric: 'field' as any,
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      teamId: 'team-1',
      teamName: 'Equipe Norte',
      metric: 'field',
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      inspections: [
        {
          inspectionId: 'insp-1',
          externalId: 'ext-insp-1',
          serviceOrderId: 'so-1',
          serviceOrderNumber: 'OS-001',
          serviceOrderAddress: 'Rua A, 123 - Centro',
          module: ModuleType.CAMPO,
          status: InspectionStatus.FINALIZADA,
          scorePercent: 97.5,
          finishedAt: new Date('2026-01-15T10:00:00.000Z'),
          createdAt: new Date('2026-01-15T09:00:00.000Z'),
        },
      ],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.CAMPO,
    });
    expect(qb.offset).toHaveBeenCalledWith(0);
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('deve usar locationDescription quando serviceOrderAddress for nulo', async () => {
    teamRepository.findOne.mockResolvedValue({
      id: 'team-1',
      name: 'Equipe Norte',
    });

    const qb = createMockQueryBuilder({
      rawMany: [
        {
          inspectionId: 'insp-1',
          serviceOrderId: null,
          serviceOrderNumber: null,
          serviceOrderAddress: null,
          locationDescription: 'Ponto de apoio - Quadra 12',
          module: ModuleType.SEGURANCA_TRABALHO,
          status: InspectionStatus.FINALIZADA,
          scorePercent: '88.5',
          finishedAt: new Date('2026-05-10T10:00:00.000Z'),
          createdAt: new Date('2026-05-10T09:00:00.000Z'),
        },
      ],
      count: 1,
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamRankingInspections('team-1', {
      from: '2026-05-01',
      to: '2026-05-26',
      metric: TeamRankingMetric.SAFETY_WORK,
      page: 1,
      limit: 20,
      sector: 'SAFETY_WORK' as any,
    });

    expect(result.inspections).toEqual([
      expect.objectContaining({
        serviceOrderAddress: 'Ponto de apoio - Quadra 12',
      }),
    ]);
  });

  it('deve permitir filtrar ranking inspections por métrica investmentWorks', async () => {
    teamRepository.findOne.mockResolvedValue({
      id: 'team-1',
      name: 'Equipe Norte',
    });

    const qb = createMockQueryBuilder({
      rawMany: [],
      count: 0,
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getTeamRankingInspections('team-1', {
      from: '2026-04-26',
      to: '2026-05-26',
      metric: TeamRankingMetric.INVESTMENT_WORKS,
      page: 1,
      limit: 20,
      sector: 'QUALITY' as any,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.OBRAS_INVESTIMENTO,
    });
  });

  it('deve usar data e contrato da inspection no ranking inspections quando métrica for safetyWork', async () => {
    teamRepository.findOne.mockResolvedValue({
      id: 'team-1',
      name: 'Equipe Norte',
    });

    const qb = createMockQueryBuilder({
      rawMany: [],
      count: 0,
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getTeamRankingInspections('team-1', {
      from: '2026-04-20',
      to: '2026-05-20',
      metric: TeamRankingMetric.SAFETY_WORK,
      page: 1,
      limit: 20,
      contractId: 'contract-1',
      user: {
        role: 'GESTOR',
        contracts: [{ id: 'contract-1' }, { id: 'contract-2' }],
      },
    });

    const andWhereCalls = qb.andWhere.mock.calls;
    expect(
      andWhereCalls.some(
        ([sql]: [string, any]) =>
          sql.includes('COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from'),
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql]: [string, any]) =>
          sql.includes('COALESCE(inspection.finalizedAt, inspection.createdAt) <= :to'),
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.contractId = :dashboardContractId') &&
          params?.dashboardContractId === 'contract-1',
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes('inspection.contractId IN (:...allowedContractIds)') &&
          Array.isArray(params?.allowedContractIds),
      ),
    ).toBe(true);
    expect(qb.orderBy).toHaveBeenCalledWith(
      expect.stringContaining(
        'CASE WHEN inspection.module = :dashboardSafetyModuleFinishedAt',
      ),
      'DESC',
      'NULLS LAST',
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'dashboardFinalizedAtPeriodModules',
      expect.any(Array),
    );
  });

  it('deve retornar payload reduzido para ranking de safety work', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          teamId: 'team-1',
          teamName: 'Equipe Norte',
          inspectionsCount: '5',
          averagePercent: '89.44',
          postWorkPercent: '90.5',
          remotePercent: '88.2',
          fieldPercent: '91.9',
          safetyWorkPercent: '87.6',
          pendingCount: '1',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSafetyWorkTeamsRanking({
      from: '2026-01-01',
      to: '2026-01-31',
      contractId: 'contract-1',
      user: { role: 'ADMIN' },
    });

    expect(result).toEqual([
      {
        teamId: 'team-1',
        teamName: 'Equipe Norte',
        averagePercent: 89.44,
        safetyWorkPercent: 87.6,
        inspectionsCount: 5,
      },
    ]);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO],
      },
    );
  });
});
