import { DashboardsService } from './dashboards.service';
import {
  ChecklistAnswer,
  InspectionScope,
  InspectionStatus,
  ModuleType,
} from '../common/enums';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  let checklistRepository: any;

  beforeEach(() => {
    inspectionsRepository = {
      createQueryBuilder: jest.fn(),
    };

    teamRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    checklistRepository = {
      findOne: jest.fn(),
    };

    service = new DashboardsService(
      inspectionsRepository as any,
      teamRepository as any,
      checklistRepository as any,
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

  it('não restringe setores de qualidade na evolução mensal de Segurança do Trabalho', async () => {
    const qb = createMockQueryBuilder({ rawMany: [] });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getQualityByService({
      from: '2026-05-01',
      to: '2026-09-04',
      sector: 'SAFETY_WORK' as any,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO],
      },
    );
    expect(
      qb.andWhere.mock.calls.some(([sql]: [string]) =>
        String(sql).includes('IN (:...allowedSectors)'),
      ),
    ).toBe(false);
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
      expect.stringContaining(
        'inspection.module = :dashboardSafetyModuleContract',
      ),
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
          teamsCount: '5',
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
        teamsCount: 5,
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
    expect(rankingQb.addSelect).toHaveBeenCalledWith(
      'COUNT(DISTINCT inspection.teamId)',
      'teamsCount',
    );
    expect(summaryQb.where).toHaveBeenCalledWith(
      'inspection.status != :draft',
      {
        draft: InspectionStatus.RASCUNHO,
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
          sectorName: 'AGUA',
          checklistItemId: 'item-1',
          checklistItemTitle: 'Uso correto de EPI',
          nonConformitiesCount: '10',
          answersCount: '40',
        },
        {
          checklistId: 'checklist-1',
          checklistName: 'Checklist Rede',
          sectorName: 'AGUA',
          checklistItemId: 'item-2',
          checklistItemTitle: 'Sinalização da área',
          nonConformitiesCount: '6',
          answersCount: '30',
        },
        {
          checklistId: 'checklist-2',
          checklistName: 'Checklist Ligação',
          sectorName: 'ESGOTO',
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
          sectorName: 'AGUA',
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
          sectorName: 'ESGOTO',
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

  it('deve retornar top não conformidades por equipe separado por checklist', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          checklistId: 'cl-1',
          checklistName: 'Checklist Campo',
          sectorName: 'ESGOTO',
          checklistItemId: 'item-1',
          checklistItemTitle: 'Uso correto de EPI',
          nonConformitiesCount: '10',
          answersCount: '40',
        },
        {
          checklistId: 'cl-1',
          checklistName: 'Checklist Campo',
          sectorName: 'ESGOTO',
          checklistItemId: 'item-2',
          checklistItemTitle: 'Sinalização da área',
          nonConformitiesCount: '6',
          answersCount: '30',
        },
        {
          checklistId: 'cl-2',
          checklistName: 'Checklist Pós-obra',
          sectorName: 'AGUA',
          checklistItemId: 'item-1',
          checklistItemTitle: 'Uso correto de EPI',
          nonConformitiesCount: '3',
          answersCount: '10',
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
      limit: 1,
    });

    expect(result).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      module: ModuleType.CAMPO,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      limit: 1,
      checklists: [
        {
          checklistId: 'cl-1',
          checklistName: 'Checklist Campo',
          sectorName: 'ESGOTO',
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
          checklistId: 'cl-2',
          checklistName: 'Checklist Pós-obra',
          sectorName: 'AGUA',
          totalNonConformities: 3,
          questions: [
            {
              checklistItemId: 'item-1',
              checklistItemTitle: 'Uso correto de EPI',
              nonConformitiesCount: 3,
              answersCount: 10,
              nonConformityRatePercent: 30,
            },
          ],
        },
      ],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.CAMPO,
    });
    expect(qb.groupBy).toHaveBeenCalledWith('checklist.id');
    expect(qb.limit).not.toHaveBeenCalled();
    expect(qb.setParameter).toHaveBeenCalledWith(
      'nonConformAnswer',
      'NAO_CONFORME',
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
        averagePercent: 90.2,
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
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...qualityRankingModules)',
      {
        qualityRankingModules: [
          ModuleType.CAMPO,
          ModuleType.POS_OBRA,
          ModuleType.REMOTO,
          ModuleType.OBRAS_INVESTIMENTO,
        ],
      },
    );
  });

  it('deve montar ranking de exportação com tipo, segmento e contagens por módulo', async () => {
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
          remoteCount: '2',
          fieldCount: '2',
          postWorkCount: '1',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);
    teamRepository.find.mockResolvedValue([
      {
        id: 'team-1',
        isContractor: true,
        sectors: [{ name: 'AGUA' }, { name: 'ESGOTO' }],
      },
    ]);

    const result = await service.getTeamsRankingForExport({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
    });

    expect(result).toEqual([
      {
        teamId: 'team-1',
        teamName: 'Equipe Norte',
        averagePercent: 90.2,
        inspectionsCount: 5,
        postWorkPercent: 90.5,
        remotePercent: 88.2,
        fieldPercent: 91.9,
        investmentWorksPercent: 84.6,
        pendingCount: 1,
        remoteInspectionsCount: 2,
        fieldInspectionsCount: 2,
        postWorkInspectionsCount: 1,
        teamType: 'EMPREITEIRO',
        segment: 'AGUA, ESGOTO',
      },
    ]);
    expect(qb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('SUM(CASE WHEN inspection.module = :remoteModule'),
      'remoteCount',
    );
  });

  it('deve calcular a média final como média das notas dos três módulos, sem ponderar pela quantidade de O.S.', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          teamId: 'team-jonatas',
          teamName: 'JONATAS SILVA',
          inspectionsCount: '65',
          averagePercent: '93.35',
          postWorkPercent: '66.67',
          remotePercent: '94.64',
          fieldPercent: null,
          investmentWorksPercent: null,
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

    expect(result[0]).toMatchObject({
      teamId: 'team-jonatas',
      fieldPercent: 0,
      remotePercent: 94.64,
      postWorkPercent: 66.67,
      averagePercent: 80.66,
    });
  });

  it('não deve tratar módulo sem vistoria como 0% na média final do ranking', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          teamId: 'team-diego',
          teamName: 'DIEGO SANTOS',
          inspectionsCount: '45',
          averagePercent: '98.67',
          postWorkPercent: null,
          remotePercent: '98.67',
          fieldPercent: null,
          investmentWorksPercent: null,
          pendingCount: '0',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamsRanking({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
    });

    expect(result[0].averagePercent).toBe(98.67);
  });

  it('deve incluir nota 0% real na média final quando o módulo teve vistoria', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          teamId: 'team-zero',
          teamName: 'Equipe Zero',
          inspectionsCount: '3',
          postWorkPercent: '100',
          remotePercent: '100',
          fieldPercent: '0',
          investmentWorksPercent: null,
          pendingCount: '0',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamsRanking({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
    });

    expect(result[0].averagePercent).toBe(66.67);
  });

  it('deve ordenar o ranking pela média dos três módulos, não pela média de todas as O.S.', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          teamId: 'team-volume',
          teamName: 'Equipe Volume',
          inspectionsCount: '50',
          averagePercent: '98',
          postWorkPercent: '50',
          remotePercent: '99',
          fieldPercent: null,
          investmentWorksPercent: null,
          pendingCount: '0',
        },
        {
          teamId: 'team-equilibrio',
          teamName: 'Equipe Equilibrio',
          inspectionsCount: '3',
          averagePercent: '90',
          postWorkPercent: '90',
          remotePercent: '90',
          fieldPercent: '90',
          investmentWorksPercent: null,
          pendingCount: '0',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getTeamsRanking({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
    });

    expect(result.map((row) => row.teamId)).toEqual([
      'team-equilibrio',
      'team-volume',
    ]);
    expect(result[0].averagePercent).toBe(90);
    expect(result[1].averagePercent).toBe(74.5);
  });

  it('deve montar overview com meses vazios e média simples', async () => {
    const qualityQb = createMockQueryBuilder({
      rawMany: [
        { month: '2026-07', averagePercent: '80', inspectionsCount: '10' },
        { month: '2026-08', averagePercent: '90', inspectionsCount: '30' },
      ],
    });
    const safetyQb = createMockQueryBuilder({
      rawMany: [
        { month: '2026-06', averagePercent: '100', inspectionsCount: '5' },
      ],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(qualityQb)
      .mockReturnValueOnce(safetyQb);

    const result = await service.getOverview({
      from: '2026-06-01',
      to: '2026-09-19',
      contractId: 'contract-1',
    });

    expect(result.from).toBe('2026-06-01');
    expect(result.to).toBe('2026-09-19');
    expect(result.quality.inspectionsCount).toBe(40);
    // (80 + 90) / 2. Julho e agosto têm vistoria; junho e setembro não entram.
    expect(result.quality.averagePercent).toBe(85);
    expect(result.quality.months).toEqual([
      { month: '2026-06', averagePercent: 0, inspectionsCount: 0 },
      { month: '2026-07', averagePercent: 80, inspectionsCount: 10 },
      { month: '2026-08', averagePercent: 90, inspectionsCount: 30 },
      { month: '2026-09', averagePercent: 0, inspectionsCount: 0 },
    ]);
    expect(result.safetyWork.inspectionsCount).toBe(5);
    expect(result.safetyWork.averagePercent).toBe(100);
    expect(result.safetyWork.months[0]).toEqual({
      month: '2026-06',
      averagePercent: 100,
      inspectionsCount: 5,
    });
    expect(qualityQb.andWhere).toHaveBeenCalledWith(
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
    expect(safetyQb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO],
      },
    );
    expect(qualityQb.andWhere).toHaveBeenCalledWith(
      'inspection.contractId = :dashboardContractId',
      { dashboardContractId: 'contract-1' },
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
      andWhereCalls.some(([sql]: [string, any]) =>
        sql.includes(
          'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
        ),
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(([sql]: [string, any]) =>
        sql.includes(
          'COALESCE(inspection.finalizedAt, inspection.createdAt) <= :to',
        ),
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
          params?.dashboardSafetyModuleContract ===
            ModuleType.SEGURANCA_TRABALHO &&
          params?.dashboardContractId === 'contract-1',
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes(
            'inspection.module = :dashboardSafetyModuleAllowedContracts',
          ) &&
          sql.includes(
            'inspection.contractId IN (:...dashboardAllowedContractIds)',
          ) &&
          sql.includes(
            'serviceOrder.contractId IN (:...dashboardAllowedContractIds)',
          ) &&
          params?.dashboardSafetyModuleAllowedContracts ===
            ModuleType.SEGURANCA_TRABALHO &&
          Array.isArray(params?.dashboardAllowedContractIds),
      ),
    ).toBe(true);
  });

  it('deve usar finalizedAt no período de qualidade para CAMPO e REMOTO', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '0',
        pendingCount: '0',
        averagePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getSummary({
      from: '2026-08-13',
      to: '2026-08-13',
      sector: 'QUALITY' as any,
    });

    expect(
      qb.andWhere.mock.calls.some(([sql]: [string]) =>
        sql.includes('COALESCE(inspection.finalizedAt, inspection.createdAt)'),
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
        postWorkApprovedCount: '4',
        remoteInspectionsCount: '3',
        remoteAveragePercent: '85.5',
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSummary({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      includeQualityModuleCounts: true,
    });

    const selects = qb.addSelect.mock.calls.map(([sql]: [string]) => sql);
    expect(
      selects.some(
        (sql) =>
          sql.includes('inspection.module = :fieldModule') &&
          sql.includes('evaluationModule') &&
          sql.startsWith('SUM'),
      ),
    ).toBe(true);
    expect(
      selects.some(
        (sql) =>
          sql.includes('inspection.module = :postWorkModule') &&
          sql.includes('evaluationModule') &&
          sql.startsWith('AVG'),
      ),
    ).toBe(true);
    expect(
      selects.some((sql) =>
        sql.includes('inspection.module = :investmentWorksModule THEN'),
      ),
    ).toBe(false);

    expect(result).toEqual({
      averagePercent: 88,
      inspectionsCount: 14,
      pendingCount: 2,
      field: {
        inspectionsCount: 5,
        averagePercent: 91.2,
      },
      postWork: {
        inspectionsCount: 4,
        averagePercent: 87.3,
        approvalRatePercent: 100,
      },
      remote: {
        inspectionsCount: 3,
        averagePercent: 85.5,
      },
    });
  });

  it('deve calcular a média geral de qualidade como média simples dos módulos com vistoria', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '943',
        pendingCount: '97',
        averagePercent: '78.18',
        fieldInspectionsCount: '0',
        fieldAveragePercent: null,
        postWorkInspectionsCount: '163',
        postWorkAveragePercent: '68.5',
        postWorkApprovedCount: '10',
        remoteInspectionsCount: '780',
        remoteAveragePercent: '80.2',
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSummary({
      from: '2026-09-01',
      to: '2026-09-30',
      sector: 'QUALITY' as any,
      includeQualityModuleCounts: true,
    });

    expect(result.averagePercent).toBe(74.35);
    expect(result.field).toEqual({
      inspectionsCount: 0,
      averagePercent: 0,
    });
    expect(result.postWork).toEqual({
      inspectionsCount: 163,
      averagePercent: 68.5,
      approvalRatePercent: 6.13,
    });
  });

  it('conta pós-obra sem não conformidade no numerador e no denominador da taxa', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '2',
        pendingCount: '0',
        averagePercent: '90',
        fieldInspectionsCount: '0',
        fieldAveragePercent: null,
        postWorkInspectionsCount: '2',
        postWorkAveragePercent: '90',
        postWorkApprovedCount: '2',
        remoteInspectionsCount: '0',
        remoteAveragePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSummary({
      from: '2026-02-01',
      to: '2026-02-28',
      sector: 'QUALITY' as any,
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
      contractId: 'contract-1',
      includeQualityModuleCounts: true,
    });

    expect(inspectionsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qb.where).toHaveBeenCalledWith('inspection.status != :draft', {
      draft: InspectionStatus.RASCUNHO,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId IS NOT NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: '7f214d1f-5e2a-46f8-8f90-e64129876f84',
    });
    expect(qb.setParameter).toHaveBeenCalledWith(
      'nonConformAnswer',
      ChecklistAnswer.NAO_CONFORME,
    );

    const approvedSql = qb.addSelect.mock.calls
      .map(([sql]: [string]) => sql)
      .find((sql: string) => sql.includes('NOT EXISTS'));
    const postWorkMatch =
      'inspection.module = :postWorkModule OR (inspection.module = :investmentWorksModule AND CAST(inspection.evaluationModule AS text) = CAST(:postWorkModule AS text))';
    expect(approvedSql).toContain(postWorkMatch);
    expect(approvedSql).toContain('inspection_items');
    expect(approvedSql).toContain(':nonConformAnswer');
    expect(approvedSql).not.toContain('scorePercent');
    expect(approvedSql).not.toContain('resolved_at');
    expect(approvedSql).not.toContain('AGUARDANDO_APROVACAO');
    expect(approvedSql).not.toContain('PENDENTE_AJUSTE');
    expect(approvedSql).not.toContain('RESOLVIDA');
    expect(approvedSql).not.toContain(':fieldModule');

    expect(result.postWork).toEqual({
      inspectionsCount: 2,
      averagePercent: 90,
      approvalRatePercent: 100,
    });
  });

  it('deixa pós-obra com não conformidade só no denominador, mesmo resolvida', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '4',
        pendingCount: '1',
        averagePercent: '70',
        fieldInspectionsCount: '0',
        fieldAveragePercent: null,
        postWorkInspectionsCount: '4',
        postWorkAveragePercent: '70',
        postWorkApprovedCount: '1',
        remoteInspectionsCount: '0',
        remoteAveragePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSummary({
      from: '2026-03-01',
      to: '2026-03-31',
      sector: 'QUALITY' as any,
      includeQualityModuleCounts: true,
    });

    const approvedSql = qb.addSelect.mock.calls
      .map(([sql]: [string]) => sql)
      .find((sql: string) => sql.includes('NOT EXISTS')) as string;
    expect(approvedSql).toContain(':nonConformAnswer');
    expect(approvedSql).not.toContain('inspection.status');
    expect(approvedSql).not.toContain('resolved_at');

    expect(result.postWork).toEqual({
      inspectionsCount: 4,
      averagePercent: 70,
      approvalRatePercent: 25,
    });
    expect(result.averagePercent).toBe(70);
  });

  it('inclui obra de investimento avaliada como pós-obra e exclui a avaliada como campo', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '1',
        pendingCount: '0',
        averagePercent: '80',
        fieldInspectionsCount: '1',
        fieldAveragePercent: '80',
        postWorkInspectionsCount: '1',
        postWorkAveragePercent: '80',
        postWorkApprovedCount: '1',
        remoteInspectionsCount: '0',
        remoteAveragePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getSummary({
      from: '2026-04-01',
      to: '2026-04-30',
      sector: 'QUALITY' as any,
      includeQualityModuleCounts: true,
    });

    const selects = qb.addSelect.mock.calls.map(([sql]: [string]) => sql);
    const postWorkMatch =
      'inspection.module = :postWorkModule OR (inspection.module = :investmentWorksModule AND CAST(inspection.evaluationModule AS text) = CAST(:postWorkModule AS text))';
    const countSql = selects.find(
      (sql: string) =>
        sql.startsWith('SUM(CASE WHEN') &&
        sql.includes(':postWorkModule') &&
        !sql.includes('NOT EXISTS'),
    );
    const approvedSql = selects.find((sql: string) => sql.includes('NOT EXISTS'));

    expect(countSql).toContain(postWorkMatch);
    expect(approvedSql).toContain(postWorkMatch);
    expect(approvedSql).not.toContain(':fieldModule');
    expect(approvedSql).not.toContain('CAMPO');
    expect(qb.setParameter).toHaveBeenCalledWith(
      'postWorkModule',
      ModuleType.POS_OBRA,
    );
  });

  it('devolve taxa nula quando o período não tem vistoria de pós-obra', async () => {
    const qb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '0',
        pendingCount: '0',
        averagePercent: null,
        fieldInspectionsCount: '0',
        fieldAveragePercent: null,
        postWorkInspectionsCount: '0',
        postWorkAveragePercent: null,
        postWorkApprovedCount: null,
        remoteInspectionsCount: '0',
        remoteAveragePercent: null,
      },
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSummary({
      from: '2026-05-01',
      to: '2026-05-31',
      sector: 'QUALITY' as any,
      includeQualityModuleCounts: true,
    });

    expect(result.postWork).toEqual({
      inspectionsCount: 0,
      averagePercent: 0,
      approvalRatePercent: null,
    });
    expect(result.inspectionsCount).toBe(0);
  });

  it('deve agregar média e vistorias por checklist no resumo de Segurança do Trabalho', async () => {
    const summaryQb = createMockQueryBuilder({
      rawOne: {
        inspectionsCount: '35',
        pendingCount: '0',
        averagePercent: '99.0',
      },
    });
    const checklistsQb = createMockQueryBuilder({
      rawMany: [
        {
          checklistId: 'cl-1',
          checklistName: 'Canteiro',
          averagePercent: '99.2',
          inspectionsCount: '20',
        },
        {
          checklistId: 'cl-2',
          checklistName: 'EPI',
          averagePercent: '98.5',
          inspectionsCount: '15',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(summaryQb)
      .mockReturnValueOnce(checklistsQb);

    const result = await service.getSafetyWorkSummary({
      from: '2026-09-01',
      to: '2026-09-10',
    });

    expect(result).toEqual({
      averagePercent: 99,
      inspectionsCount: 35,
      pendingCount: 0,
      checklists: [
        {
          checklistId: 'cl-1',
          checklistName: 'Canteiro',
          averagePercent: 99.2,
          inspectionsCount: 20,
        },
        {
          checklistId: 'cl-2',
          checklistName: 'EPI',
          averagePercent: 98.5,
          inspectionsCount: 15,
        },
      ],
    });
    expect(checklistsQb.innerJoin).toHaveBeenCalledWith(
      'inspection.checklist',
      'checklist',
    );
    expect(checklistsQb.groupBy).toHaveBeenCalledWith('checklist.id');
    expect(checklistsQb.addSelect).toHaveBeenCalledWith(
      'AVG(inspection.scorePercent)',
      'averagePercent',
    );
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
          params?.dashboardSafetyModuleContract ===
            ModuleType.SEGURANCA_TRABALHO,
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(
        ([sql, params]: [string, any]) =>
          sql.includes(
            'inspection.module = :dashboardSafetyModuleAllowedContracts',
          ) &&
          sql.includes(
            'inspection.contractId IN (:...dashboardAllowedContractIds)',
          ) &&
          sql.includes(
            'serviceOrder.contractId IN (:...dashboardAllowedContractIds)',
          ) &&
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
          evaluationModule: null,
          status: InspectionStatus.FINALIZADA,
          scorePercent: 97.5,
          finishedAt: new Date('2026-01-15T10:00:00.000Z'),
          createdAt: new Date('2026-01-15T09:00:00.000Z'),
        },
      ],
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(inspection.module = :rankingTargetModule OR (inspection.module = :investmentWorksModule AND CAST(inspection.evaluationModule AS text) = CAST(:rankingTargetModule AS text)))',
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'rankingTargetModule',
      ModuleType.CAMPO,
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'investmentWorksModule',
      ModuleType.OBRAS_INVESTIMENTO,
    );
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

  it('deve incluir Obras de Investimento classificadas como Pós-obra no drill-down de Pós-obra', async () => {
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
      from: '2026-01-01',
      to: '2026-01-31',
      metric: TeamRankingMetric.POST_WORK,
      page: 1,
      limit: 20,
      sector: 'QUALITY' as any,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      '(inspection.module = :rankingTargetModule OR (inspection.module = :investmentWorksModule AND CAST(inspection.evaluationModule AS text) = CAST(:rankingTargetModule AS text)))',
    );
    expect(qb.setParameter).toHaveBeenCalledWith(
      'rankingTargetModule',
      ModuleType.POS_OBRA,
    );
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
      andWhereCalls.some(([sql]: [string, any]) =>
        sql.includes(
          'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
        ),
      ),
    ).toBe(true);
    expect(
      andWhereCalls.some(([sql]: [string, any]) =>
        sql.includes(
          'COALESCE(inspection.finalizedAt, inspection.createdAt) <= :to',
        ),
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
        'COALESCE(inspection.finalizedAt, inspection.createdAt)',
      ),
      'DESC',
      'NULLS LAST',
    );
  });

  it('deve listar as vistorias do checklist de segurança com os filtros do resumo', async () => {
    checklistRepository.findOne.mockResolvedValue({
      id: 'cl-1',
      name: 'Vistoria de Canteiro',
    });

    const finishedAt = new Date('2026-09-10T12:00:00.000Z');
    const createdAt = new Date('2026-09-10T11:00:00.000Z');
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          inspectionId: 'insp-1',
          externalId: 'ext-1',
          teamId: 'team-1',
          teamName: 'Equipe Norte',
          serviceOrderId: null,
          serviceOrderNumber: null,
          serviceOrderAddress: null,
          locationDescription: 'Canteiro Norte',
          module: ModuleType.SEGURANCA_TRABALHO,
          evaluationModule: null,
          status: InspectionStatus.FINALIZADA,
          scorePercent: '99.6',
          finishedAt,
          createdAt,
        },
      ],
      count: 1,
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSafetyWorkChecklistInspections('cl-1', {
      from: '2026-09-01',
      to: '2026-09-21',
      page: 1,
      limit: 20,
      contractId: 'contract-1',
      user: {
        role: 'GESTOR',
        contracts: [{ id: 'contract-1' }],
      },
    });

    expect(result).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-21',
      checklistId: 'cl-1',
      checklistName: 'Vistoria de Canteiro',
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(result.inspections[0]).toEqual({
      inspectionId: 'insp-1',
      externalId: 'ext-1',
      teamId: 'team-1',
      teamName: 'Equipe Norte',
      serviceOrderId: null,
      serviceOrderNumber: null,
      serviceOrderAddress: 'Canteiro Norte',
      module: ModuleType.SEGURANCA_TRABALHO,
      evaluationModule: null,
      status: InspectionStatus.FINALIZADA,
      scorePercent: 99.6,
      finishedAt,
      createdAt,
    });
    expect(qb.where).toHaveBeenCalledWith('inspection.status != :draft', {
      draft: InspectionStatus.RASCUNHO,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId IS NOT NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('checklist.id = :checklistId', {
      checklistId: 'cl-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO],
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
      { from: '2026-09-01' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.contractId = :dashboardContractId',
      { dashboardContractId: 'contract-1' },
    );
  });

  it('deve retornar 404 quando o checklist de segurança não existe', async () => {
    checklistRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getSafetyWorkChecklistInspections('missing', {
        from: '2026-09-01',
        to: '2026-09-21',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
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

  it('deve agregar produção diária por fiscal apenas em Segurança do Trabalho', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          userId: 'user-2',
          userName: 'Richardson Constantino',
          day: '2026-09-01',
          inspectionsCount: '2',
        },
        {
          userId: 'user-2',
          userName: 'Richardson Constantino',
          day: '2026-09-03',
          inspectionsCount: '1',
        },
        {
          userId: 'user-1',
          userName: 'Daiana Freire',
          day: '2026-09-01',
          inspectionsCount: '3',
        },
        {
          userId: 'user-1',
          userName: 'Daiana Freire',
          day: '2026-09-02',
          inspectionsCount: '2',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getSafetyWorkInspectorsProduction({
      from: '2026-09-01',
      to: '2026-09-03',
      contractId: 'contract-1',
      user: { role: 'ADMIN' },
    });

    expect(result.from).toBe('2026-09-01');
    expect(result.to).toBe('2026-09-03');
    expect(result.days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(result.inspectors).toEqual([
      {
        userId: 'user-1',
        userName: 'Daiana Freire',
        inspectionsCount: 5,
        daysWithInspections: 2,
        dailyAverage: 2.5,
        dailyCounts: [
          { date: '2026-09-01', count: 3 },
          { date: '2026-09-02', count: 2 },
          { date: '2026-09-03', count: 0 },
        ],
      },
      {
        userId: 'user-2',
        userName: 'Richardson Constantino',
        inspectionsCount: 3,
        daysWithInspections: 2,
        dailyAverage: 1.5,
        dailyCounts: [
          { date: '2026-09-01', count: 2 },
          { date: '2026-09-02', count: 0 },
          { date: '2026-09-03', count: 1 },
        ],
      },
    ]);

    expect(qb.innerJoin).toHaveBeenCalledWith(
      'inspection.createdBy',
      'createdBy',
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      {
        dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO],
      },
    );
    expect(
      qb.andWhere.mock.calls.some(([sql]: [string]) =>
        sql.includes(
          'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
        ),
      ),
    ).toBe(true);
  });

  it('deve agregar produção diária por fiscal nos módulos de Qualidade', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        {
          userId: 'user-1',
          userName: 'Daiana Freire',
          day: '2026-09-01',
          inspectionsCount: '4',
        },
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityInspectorsProduction({
      from: '2026-09-01',
      to: '2026-09-02',
      contractId: 'contract-1',
      user: { role: 'ADMIN' },
    });

    expect(result.days).toEqual(['2026-09-01', '2026-09-02']);
    expect(result.inspectors[0]).toMatchObject({
      userId: 'user-1',
      inspectionsCount: 4,
      daysWithInspections: 1,
      dailyAverage: 4,
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
    expect(
      qb.andWhere.mock.calls.some(([sql]: [string]) =>
        sql.includes("DATE(timezone('America/Sao_Paulo'"),
      ),
    ).toBe(true);
    expect(
      qb.andWhere.mock.calls.some(([sql]: [string]) =>
        sql.includes(
          'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
        ),
      ),
    ).toBe(false);
  });

  it('deve filtrar a produção de Qualidade pelo tipo Campo, incluindo obras avaliadas como Campo', async () => {
    const qb = createMockQueryBuilder({ rawMany: [] });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getQualityInspectorsProduction({
      from: '2026-09-01',
      to: '2026-09-02',
      module: ModuleType.CAMPO,
      user: { role: 'ADMIN' },
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('investmentWorksModule'),
      {
        module: ModuleType.CAMPO,
        investmentWorksModule: ModuleType.OBRAS_INVESTIMENTO,
      },
    );
  });

  it('deve rejeitar tipo fora de Campo, Remoto e Pós-obra na produção dos fiscais', async () => {
    const qb = createMockQueryBuilder({ rawMany: [] });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.getQualityInspectorsProduction({
        from: '2026-09-01',
        to: '2026-09-02',
        module: ModuleType.SEGURANCA_TRABALHO,
        user: { role: 'ADMIN' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve agregar resultado de Qualidade pelo encarregado atual da equipe', async () => {
    const summaryQb = createMockQueryBuilder({
      rawMany: [
        {
          foremanId: 'foreman-2',
          foremanName: 'Bruno',
          averagePercent: '70',
          inspectionsCount: '2',
          pendingAdjustmentsCount: '1',
          resolvedCount: '0',
        },
        {
          foremanId: 'foreman-1',
          foremanName: 'Ana',
          averagePercent: '90.5',
          inspectionsCount: '4',
          pendingAdjustmentsCount: '0',
          resolvedCount: '3',
        },
      ],
    });
    const nonConformitiesQb = createMockQueryBuilder({
      rawMany: [
        { foremanId: 'foreman-1', nonConformitiesCount: '5' },
        { foremanId: 'foreman-2', nonConformitiesCount: '1' },
      ],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(summaryQb)
      .mockReturnValueOnce(nonConformitiesQb);
    teamRepository.find.mockResolvedValue([
      { id: 'team-b', name: 'Equipe B', foremanId: 'foreman-1' },
      { id: 'team-a', name: 'Equipe A', foremanId: 'foreman-1' },
      { id: 'team-c', name: 'Equipe C', foremanId: 'foreman-2' },
    ]);

    const result = await service.getQualityForemenRanking({
      from: '2026-09-01',
      to: '2026-09-30',
      user: { role: 'ADMIN' },
    });

    expect(result.foremen).toEqual([
      {
        foremanId: 'foreman-1',
        foremanName: 'Ana',
        teams: [
          { id: 'team-b', name: 'Equipe B' },
          { id: 'team-a', name: 'Equipe A' },
        ],
        averagePercent: 90.5,
        inspectionsCount: 4,
        nonConformitiesCount: 5,
        pendingAdjustmentsCount: 0,
        resolvedCount: 3,
      },
      {
        foremanId: 'foreman-2',
        foremanName: 'Bruno',
        teams: [{ id: 'team-c', name: 'Equipe C' }],
        averagePercent: 70,
        inspectionsCount: 2,
        nonConformitiesCount: 1,
        pendingAdjustmentsCount: 1,
        resolvedCount: 0,
      },
    ]);
    expect(summaryQb.innerJoin).toHaveBeenCalledWith('team.foreman', 'foreman');
    expect(summaryQb.andWhere).toHaveBeenCalledWith(
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

  it('deve agregar Qualidade pelo supervisor e pelo coordenador da hierarquia atual', async () => {
    const supervisorSummaryQb = createMockQueryBuilder({
      rawMany: [
        {
          personId: 'sup-2',
          personName: 'Bruno',
          averagePercent: '60',
          inspectionsCount: '1',
          pendingAdjustmentsCount: '0',
          resolvedCount: '0',
        },
        {
          personId: 'sup-1',
          personName: 'Ana',
          averagePercent: '80',
          inspectionsCount: '3',
          pendingAdjustmentsCount: '1',
          resolvedCount: '1',
        },
      ],
    });
    const supervisorNcQb = createMockQueryBuilder({
      rawMany: [{ personId: 'sup-1', nonConformitiesCount: '4' }],
    });
    const teamsQb = createMockQueryBuilder({
      rawMany: [
        { id: 'team-b', name: 'Equipe B', personId: 'sup-1' },
        { id: 'team-a', name: 'Equipe A', personId: 'sup-1' },
      ],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(supervisorSummaryQb)
      .mockReturnValueOnce(supervisorNcQb);
    teamRepository.createQueryBuilder = jest.fn().mockReturnValue(teamsQb);

    const supervisors = await service.getQualityFieldSupervisorsRanking({
      from: '2026-09-01',
      to: '2026-09-30',
      user: { role: 'ADMIN' },
    });

    expect(supervisors.supervisors).toEqual([
      {
        id: 'sup-1',
        name: 'Ana',
        teams: [
          { id: 'team-b', name: 'Equipe B' },
          { id: 'team-a', name: 'Equipe A' },
        ],
        averagePercent: 80,
        inspectionsCount: 3,
        nonConformitiesCount: 4,
        pendingAdjustmentsCount: 1,
        resolvedCount: 1,
      },
      {
        id: 'sup-2',
        name: 'Bruno',
        teams: [],
        averagePercent: 60,
        inspectionsCount: 1,
        nonConformitiesCount: 0,
        pendingAdjustmentsCount: 0,
        resolvedCount: 0,
      },
    ]);
    expect(supervisorSummaryQb.innerJoin).toHaveBeenCalledWith(
      'foreman.fieldSupervisor',
      'fieldSupervisor',
    );
    expect(supervisorSummaryQb.innerJoin).not.toHaveBeenCalledWith(
      'fieldSupervisor.coordinator',
      'coordinator',
    );
    expect(teamsQb.where).toHaveBeenCalledWith(
      'fieldSupervisor.id IN (:...personIds)',
      { personIds: ['sup-2', 'sup-1'] },
    );

    const coordinatorSummaryQb = createMockQueryBuilder({
      rawMany: [
        {
          personId: 'coord-1',
          personName: 'Carla',
          averagePercent: '91.2',
          inspectionsCount: '6',
          pendingAdjustmentsCount: '2',
          resolvedCount: '3',
        },
      ],
    });
    const coordinatorNcQb = createMockQueryBuilder({ rawMany: [] });
    const coordinatorTeamsQb = createMockQueryBuilder({
      rawMany: [{ id: 'team-a', name: 'Equipe A', personId: 'coord-1' }],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(coordinatorSummaryQb)
      .mockReturnValueOnce(coordinatorNcQb);
    teamRepository.createQueryBuilder = jest
      .fn()
      .mockReturnValue(coordinatorTeamsQb);

    const coordinators = await service.getQualityCoordinatorsRanking({
      from: '2026-09-01',
      to: '2026-09-30',
      user: { role: 'ADMIN' },
    });

    expect(coordinators.coordinators).toEqual([
      {
        id: 'coord-1',
        name: 'Carla',
        teams: [{ id: 'team-a', name: 'Equipe A' }],
        averagePercent: 91.2,
        inspectionsCount: 6,
        nonConformitiesCount: 0,
        pendingAdjustmentsCount: 2,
        resolvedCount: 3,
      },
    ]);
    expect(coordinatorSummaryQb.innerJoin).toHaveBeenCalledWith(
      'fieldSupervisor.coordinator',
      'coordinator',
    );
    expect(coordinatorTeamsQb.innerJoin).toHaveBeenCalledWith(
      'fieldSupervisor.coordinator',
      'coordinator',
    );
    expect(coordinatorSummaryQb.andWhere).toHaveBeenCalledWith(
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

  it('deve agrupar encarregados só com vistorias de Segurança do Trabalho', async () => {
    const summaryQb = createMockQueryBuilder({
      rawMany: [
        {
          foremanId: 'foreman-1',
          foremanName: 'Ana',
          averagePercent: '88',
          inspectionsCount: '3',
          pendingAdjustmentsCount: '1',
          resolvedCount: '1',
        },
      ],
    });
    const nonConformitiesQb = createMockQueryBuilder({
      rawMany: [{ foremanId: 'foreman-1', nonConformitiesCount: '2' }],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(summaryQb)
      .mockReturnValueOnce(nonConformitiesQb);
    teamRepository.find.mockResolvedValue([
      { id: 'team-a', name: 'Equipe A', foremanId: 'foreman-1' },
    ]);

    const result = await service.getSafetyWorkForemenRanking({
      from: '2026-09-01',
      to: '2026-09-30',
      user: { role: 'ADMIN' },
    });

    expect(result.foremen).toEqual([
      {
        foremanId: 'foreman-1',
        foremanName: 'Ana',
        teams: [{ id: 'team-a', name: 'Equipe A' }],
        averagePercent: 88,
        inspectionsCount: 3,
        nonConformitiesCount: 2,
        pendingAdjustmentsCount: 1,
        resolvedCount: 1,
      },
    ]);
    expect(summaryQb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      { dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO] },
    );
    expect(summaryQb.andWhere).toHaveBeenCalledWith(
      'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
      { from: '2026-09-01' },
    );
  });

  it('deve agregar Segurança pelo supervisor e pelo coordenador da hierarquia atual', async () => {
    const supervisorSummaryQb = createMockQueryBuilder({
      rawMany: [
        {
          personId: 'sup-1',
          personName: 'Ana',
          averagePercent: '80',
          inspectionsCount: '3',
          pendingAdjustmentsCount: '1',
          resolvedCount: '1',
        },
      ],
    });
    const supervisorNcQb = createMockQueryBuilder({
      rawMany: [{ personId: 'sup-1', nonConformitiesCount: '2' }],
    });
    const teamsQb = createMockQueryBuilder({
      rawMany: [{ id: 'team-a', name: 'Equipe A', personId: 'sup-1' }],
    });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(supervisorSummaryQb)
      .mockReturnValueOnce(supervisorNcQb);
    teamRepository.createQueryBuilder = jest.fn().mockReturnValue(teamsQb);

    const supervisors = await service.getSafetyWorkFieldSupervisorsRanking({
      from: '2026-09-01',
      to: '2026-09-30',
      user: { role: 'ADMIN' },
    });

    expect(supervisors.supervisors).toEqual([
      {
        id: 'sup-1',
        name: 'Ana',
        teams: [{ id: 'team-a', name: 'Equipe A' }],
        averagePercent: 80,
        inspectionsCount: 3,
        nonConformitiesCount: 2,
        pendingAdjustmentsCount: 1,
        resolvedCount: 1,
      },
    ]);
    expect(supervisorSummaryQb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      { dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO] },
    );
    expect(supervisorSummaryQb.andWhere).toHaveBeenCalledWith(
      'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
      { from: '2026-09-01' },
    );

    const coordinatorSummaryQb = createMockQueryBuilder({
      rawMany: [
        {
          personId: 'coord-1',
          personName: 'Carla',
          averagePercent: '91.2',
          inspectionsCount: '4',
          pendingAdjustmentsCount: '0',
          resolvedCount: '2',
        },
      ],
    });
    const coordinatorNcQb = createMockQueryBuilder({ rawMany: [] });
    const coordinatorTeamsQb = createMockQueryBuilder({ rawMany: [] });
    inspectionsRepository.createQueryBuilder
      .mockReturnValueOnce(coordinatorSummaryQb)
      .mockReturnValueOnce(coordinatorNcQb);
    teamRepository.createQueryBuilder = jest
      .fn()
      .mockReturnValue(coordinatorTeamsQb);

    const coordinators = await service.getSafetyWorkCoordinatorsRanking({
      from: '2026-09-01',
      to: '2026-09-30',
      user: { role: 'ADMIN' },
    });

    expect(coordinators.coordinators[0]).toEqual(
      expect.objectContaining({
        id: 'coord-1',
        name: 'Carla',
        averagePercent: 91.2,
        inspectionsCount: 4,
      }),
    );
    expect(coordinatorSummaryQb.innerJoin).toHaveBeenCalledWith(
      'fieldSupervisor.coordinator',
      'coordinator',
    );
    expect(coordinatorSummaryQb.andWhere).toHaveBeenCalledWith(
      'inspection.module IN (:...dashboardSectorModules)',
      { dashboardSectorModules: [ModuleType.SEGURANCA_TRABALHO] },
    );
  });

  it('deve rejeitar intervalo invertido na produção de fiscais', async () => {
    await expect(
      service.getSafetyWorkInspectorsProduction({
        from: '2026-09-04',
        to: '2026-09-01',
      }),
    ).rejects.toThrow('A data inicial (from) não pode ser posterior');
    expect(inspectionsRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  function qualityNcRow(overrides: Record<string, string>) {
    return {
      effectiveModule: 'CAMPO',
      checklistId: 'cl-1',
      checklistName: 'Checklist',
      sectorName: 'AGUA',
      checklistItemId: 'item-1',
      checklistItemTitle: 'Pergunta',
      nonConformitiesCount: '1',
      answersCount: '4',
      ...overrides,
    };
  }

  it('coloca obra de investimento avaliada como CAMPO no grupo Campo', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        qualityNcRow({
          effectiveModule: 'CAMPO',
          checklistId: 'cl-obra-campo',
          checklistName: 'Checklist Obra Campo',
          sectorName: 'AGUA',
          checklistItemId: 'item-1',
          checklistItemTitle: 'Compactação',
          nonConformitiesCount: '4',
          answersCount: '10',
        }),
        qualityNcRow({
          effectiveModule: 'CAMPO',
          checklistId: 'cl-obra-campo',
          checklistName: 'Checklist Obra Campo',
          sectorName: 'AGUA',
          checklistItemId: 'item-2',
          checklistItemTitle: 'Sinalização',
          nonConformitiesCount: '1',
          answersCount: '10',
        }),
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityNonConformitiesList({
      from: '2026-01-01',
      to: '2026-01-31',
      sector: 'QUALITY' as any,
      module: ModuleType.OBRAS_INVESTIMENTO,
      limitPerChecklist: 1,
    });

    const effectiveModuleSql = qb.select.mock.calls[0][0] as string;
    expect(effectiveModuleSql).toContain(
      'inspection.module = :fieldModule OR (inspection.module = :investmentWorksModule AND CAST(inspection.evaluationModule AS text) = CAST(:fieldModule AS text))',
    );
    const campoThen = effectiveModuleSql.indexOf("THEN 'CAMPO'");
    const fieldMatch = effectiveModuleSql.indexOf('CAST(:fieldModule AS text)');
    expect(fieldMatch).toBeGreaterThan(-1);
    expect(campoThen).toBeGreaterThan(fieldMatch);
    expect(effectiveModuleSql).not.toContain("THEN 'OBRAS_INVESTIMENTO'");
    expect(effectiveModuleSql).not.toContain('AGUARDANDO_APROVACAO');
    expect(qb.where).toHaveBeenCalledWith(
      'inspection.status IN (:...qualityStatuses)',
      {
        qualityStatuses: [
          InspectionStatus.FINALIZADA,
          InspectionStatus.PENDENTE_AJUSTE,
          InspectionStatus.RESOLVIDA,
        ],
      },
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'inspection.module = :module',
      expect.anything(),
    );
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
    expect(qb.groupBy).toHaveBeenCalledWith(effectiveModuleSql);
    expect(result.modules.map((module) => module.module)).toEqual(['CAMPO']);
    expect(result.limitPerChecklist).toBe(1);
    expect(result.modules[0].sectors[0].checklists).toEqual([
      {
        checklistId: 'cl-obra-campo',
        checklistName: 'Checklist Obra Campo',
        totalNonConformities: 5,
        questions: [
          {
            checklistItemId: 'item-1',
            checklistItemTitle: 'Compactação',
            nonConformitiesCount: 4,
            answersCount: 10,
            nonConformityRatePercent: 40,
          },
        ],
      },
    ]);
  });

  it('coloca obra de investimento avaliada como POS_OBRA no grupo Pós-obra', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        qualityNcRow({
          effectiveModule: 'POS_OBRA',
          checklistId: 'cl-obra-pos',
          checklistName: 'Passeio',
          sectorName: 'REPOSICAO',
          nonConformitiesCount: '3',
          answersCount: '12',
        }),
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityNonConformitiesList({
      from: '2026-02-01',
      to: '2026-02-28',
      sector: 'QUALITY' as any,
    });

    const effectiveModuleSql = qb.select.mock.calls[0][0] as string;
    expect(effectiveModuleSql).toContain(
      'inspection.module = :postWorkModule OR (inspection.module = :investmentWorksModule AND CAST(inspection.evaluationModule AS text) = CAST(:postWorkModule AS text))',
    );
    const postWorkThen = effectiveModuleSql.indexOf("THEN 'POS_OBRA'");
    const postWorkMatch = effectiveModuleSql.indexOf(
      'CAST(:postWorkModule AS text)',
    );
    expect(postWorkMatch).toBeGreaterThan(-1);
    expect(postWorkThen).toBeGreaterThan(postWorkMatch);
    expect(result.modules.map((module) => module.module)).toEqual(['POS_OBRA']);
    expect(result.modules[0].sectors[0]).toMatchObject({
      sectorName: 'REPOSICAO',
      checklists: [
        expect.objectContaining({
          checklistId: 'cl-obra-pos',
          totalNonConformities: 3,
          questions: [
            expect.objectContaining({ nonConformityRatePercent: 25 }),
          ],
        }),
      ],
    });
  });

  it('mantém obra de investimento sem evaluationModule no bloco sem tipo', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        qualityNcRow({
          effectiveModule: 'OBRA_SEM_TIPO',
          checklistId: 'cl-sem-tipo',
          checklistName: 'Obra sem tipo',
          sectorName: 'ESGOTO',
          nonConformitiesCount: '2',
          answersCount: '8',
        }),
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityNonConformitiesList({
      from: '2026-03-01',
      to: '2026-03-31',
    });

    const effectiveModuleSql = qb.select.mock.calls[0][0] as string;
    expect(effectiveModuleSql).toContain(
      "inspection.module = :investmentWorksModule AND inspection.evaluationModule IS NULL THEN 'OBRA_SEM_TIPO'",
    );
    expect(result.modules).toEqual([
      {
        module: 'OBRA_SEM_TIPO',
        sectors: [
          {
            sectorName: 'ESGOTO',
            checklists: [
              {
                checklistId: 'cl-sem-tipo',
                checklistName: 'Obra sem tipo',
                totalNonConformities: 2,
                questions: [
                  {
                    checklistItemId: 'item-1',
                    checklistItemTitle: 'Pergunta',
                    nonConformitiesCount: 2,
                    answersCount: 8,
                    nonConformityRatePercent: 25,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('não mistura Campo, Remoto e Pós-obra no mesmo checklist', async () => {
    const qb = createMockQueryBuilder({
      rawMany: [
        qualityNcRow({
          effectiveModule: 'CAMPO',
          checklistId: 'cl-shared',
          checklistName: 'Checklist Compartilhado',
          sectorName: 'AGUA',
          nonConformitiesCount: '4',
          answersCount: '10',
        }),
        qualityNcRow({
          effectiveModule: 'REMOTO',
          checklistId: 'cl-shared',
          checklistName: 'Checklist Compartilhado',
          sectorName: 'AGUA',
          checklistItemId: 'item-remoto',
          nonConformitiesCount: '2',
          answersCount: '10',
        }),
        qualityNcRow({
          effectiveModule: 'POS_OBRA',
          checklistId: 'cl-shared',
          checklistName: 'Checklist Compartilhado',
          sectorName: 'AGUA',
          checklistItemId: 'item-pos',
          nonConformitiesCount: '7',
          answersCount: '10',
        }),
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityNonConformitiesList({
      from: '2026-04-01',
      to: '2026-04-30',
    });

    expect(result.modules.map((module) => module.module)).toEqual([
      'REMOTO',
      'POS_OBRA',
      'CAMPO',
    ]);
    const totals = Object.fromEntries(
      result.modules.map((module) => [
        module.module,
        module.sectors[0].checklists[0].totalNonConformities,
      ]),
    );
    expect(totals).toEqual({ REMOTO: 2, POS_OBRA: 7, CAMPO: 4 });
    for (const module of result.modules) {
      expect(module.sectors[0].checklists[0].checklistId).toBe('cl-shared');
    }
    expect(qb.groupBy).toHaveBeenCalledWith(qb.select.mock.calls[0][0]);
  });

  it('restringe a lista de não conformidades ao teamId informado', async () => {
    const teamId = '7f214d1f-5e2a-46f8-8f90-e64129876f84';
    const qb = createMockQueryBuilder({
      rawMany: [
        qualityNcRow({
          effectiveModule: 'REMOTO',
          checklistId: 'cl-equipe',
          checklistName: 'Checklist da equipe',
          sectorName: 'ESGOTO',
          nonConformitiesCount: '3',
          answersCount: '6',
        }),
      ],
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityNonConformitiesList({
      from: '2026-05-01',
      to: '2026-05-31',
      teamId,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId,
    });
    expect(result.teamId).toBe(teamId);
    expect(result.modules).toHaveLength(1);
    expect(
      result.modules[0].sectors[0].checklists[0].totalNonConformities,
    ).toBe(3);
  });

  it('devolve setor fora da ordem nomeada no fim do módulo', async () => {
    const sectors = [
      'HIDROMETRIA',
      'DRENAGEM',
      'AGUA',
      'DESOBSTRUCAO',
      'ESGOTO',
      'REPOSICAO',
    ];
    const qb = createMockQueryBuilder({
      rawMany: sectors.flatMap((sectorName) => [
        qualityNcRow({
          effectiveModule: 'REMOTO',
          checklistId: `cl-${sectorName}-z`,
          checklistName: 'Zeta',
          sectorName,
          checklistItemId: `item-${sectorName}-z`,
          nonConformitiesCount: '1',
          answersCount: '4',
        }),
        qualityNcRow({
          effectiveModule: 'REMOTO',
          checklistId: `cl-${sectorName}-a`,
          checklistName: 'Alfa',
          sectorName,
          checklistItemId: `item-${sectorName}-a`,
          nonConformitiesCount: '2',
          answersCount: '4',
        }),
      ]),
    });
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQualityNonConformitiesList({
      from: '2026-06-01',
      to: '2026-06-30',
    });

    expect(result.modules.map((module) => module.module)).toEqual(['REMOTO']);
    const remote = result.modules[0];
    expect(remote.sectors.map((sector) => sector.sectorName)).toEqual([
      'AGUA',
      'ESGOTO',
      'REPOSICAO',
      'DESOBSTRUCAO',
      'HIDROMETRIA',
      'DRENAGEM',
    ]);
    const extra = remote.sectors.find(
      (sector) => sector.sectorName === 'DRENAGEM',
    );
    expect(extra?.checklists.map((checklist) => checklist.checklistName)).toEqual(
      ['Alfa', 'Zeta'],
    );
  });
});
