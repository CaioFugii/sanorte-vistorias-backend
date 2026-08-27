import { ForbiddenException } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { Inspection } from '../entities';
import {
  ChecklistAnswer,
  InspectionScope,
  InspectionStatus,
  ModuleType,
  UserRole,
} from '../common/enums';
import { InspectionDomainService } from './inspection-domain.service';

describe('InspectionsService', () => {
  let service: InspectionsService;
  let inspectionsRepository: any;
  let inspectionItemsRepository: any;
  let evidencesRepository: any;
  let signaturesRepository: any;
  let pendingAdjustmentsRepository: any;
  let checklistItemsRepository: any;
  let teamsRepository: any;
  let serviceOrderRepository: any;
  let investmentWorkRepository: any;
  let dataSource: any;
  let assetStorage: {
    uploadImage: jest.Mock;
    uploadImageFromPath: jest.Mock;
    deleteAsset: jest.Mock;
    createDirectUpload: jest.Mock;
    getPublicUrl: jest.Mock;
    statObject: jest.Mock;
  };
  let assetStorageRegistry: {
    deleteStoredAsset: jest.Mock;
  };

  beforeEach(async () => {
    inspectionsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    inspectionItemsRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    evidencesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    signaturesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    pendingAdjustmentsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    checklistItemsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    teamsRepository = {
      findOne: jest.fn(),
    };

    serviceOrderRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    investmentWorkRepository = {
      findOne: jest.fn(),
    };

    assetStorageRegistry = {
      deleteStoredAsset: jest.fn(),
    };

    assetStorage = {
      uploadImage: jest.fn(),
      uploadImageFromPath: jest.fn(),
      deleteAsset: jest.fn(),
      createDirectUpload: jest.fn(),
      getPublicUrl: jest.fn(),
      statObject: jest.fn(),
    };

    dataSource = {
      getRepository: jest.fn(),
    };

    service = new InspectionsService(
      inspectionsRepository as any,
      inspectionItemsRepository as any,
      evidencesRepository as any,
      signaturesRepository as any,
      pendingAdjustmentsRepository as any,
      checklistItemsRepository as any,
      {} as any,
      teamsRepository as any,
      serviceOrderRepository as any,
      investmentWorkRepository as any,
      assetStorage as any,
      assetStorageRegistry as any,
      dataSource as any,
      new InspectionDomainService(),
    );
  });

  it('deve calcular percentual corretamente', async () => {
    const inspectionId = 'test-id';
    const mockItems = [
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.NAO_CONFORME },
      { answer: ChecklistAnswer.NAO_APLICAVEL },
    ];

    inspectionItemsRepository.find.mockResolvedValue(mockItems);

    const percent = await service.calculateScorePercent(inspectionId);

    expect(percent).toBeCloseTo(66.67, 2); // 2 conforme / 3 avaliados = 66.67%
  });

  it('deve retornar 100 quando não há itens avaliados', async () => {
    const inspectionId = 'test-id';
    const mockItems = [
      { answer: ChecklistAnswer.NAO_APLICAVEL },
      { answer: ChecklistAnswer.NAO_APLICAVEL },
    ];

    inspectionItemsRepository.find.mockResolvedValue(mockItems);

    const percent = await service.calculateScorePercent(inspectionId);

    expect(percent).toBe(100);
  });

  it('deve ser idempotente por externalId no endpoint de sync', async () => {
    const syncPayload = {
      externalId: '31a9e29b-1ca9-4d69-a6cf-e6367471743f',
      module: ModuleType.QUALIDADE,
      checklistId: 'checklist-id',
      teamId: 'team-id',
      serviceOrderId: 'service-order-id',
      serviceDescription: 'Vistoria offline',
      createdOffline: true,
    };

    const createdInspection = {
      id: 'server-id-1',
      status: 'RASCUNHO',
      module: ModuleType.QUALIDADE,
      checklistId: 'checklist-id',
      teamId: 'team-id',
      serviceDescription: 'Vistoria offline',
      locationDescription: null,
      createdOffline: true,
    } as unknown as Inspection;

    const persistSpy = jest
      .spyOn(service as any, 'persistNewInspection')
      .mockResolvedValue(createdInspection);

    inspectionsRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...createdInspection,
        id: 'server-id-1',
      });
    teamsRepository.findOne.mockResolvedValue({ id: 'team-id' });

    const first = await service.syncInspections(
      [syncPayload],
      'user-id',
      UserRole.FISCAL,
    );
    const second = await service.syncInspections(
      [syncPayload],
      'user-id',
      UserRole.FISCAL,
    );

    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(first.results[0]).toMatchObject({
      externalId: syncPayload.externalId,
      serverId: 'server-id-1',
      status: 'CREATED',
    });
    expect(second.results[0]).toMatchObject({
      externalId: syncPayload.externalId,
      serverId: 'server-id-1',
      status: 'UPDATED',
    });
  });

  it('deve rejeitar payload com assets em dataUrl no sync', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'server-id-2',
      externalId: '31a9e29b-1ca9-4d69-a6cf-e6367471743f',
      status: 'RASCUNHO',
      collaborators: [],
    });
    teamsRepository.findOne.mockResolvedValue({ id: 'team-id' });

    const result = await service.syncInspections(
      [
        {
          externalId: '31a9e29b-1ca9-4d69-a6cf-e6367471743f',
          module: ModuleType.QUALIDADE,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          serviceDescription: 'Vistoria offline',
          evidences: [{ dataUrl: 'data:image/png;base64,AAAA' }],
        },
      ] as any,
      'user-id',
      UserRole.FISCAL,
    );

    expect(result.results[0]).toMatchObject({
      status: 'ERROR',
      message: 'Assets must be uploaded before sync',
    });
  });

  it('deve aplicar paralisação quando payload de sync informar paralyze.reason', async () => {
    const createdInspection = {
      id: 'server-id-3',
      status: 'RASCUNHO',
      module: ModuleType.QUALIDADE,
      checklistId: 'checklist-id',
      teamId: 'team-id',
      serviceDescription: 'Vistoria offline',
      locationDescription: null,
      createdOffline: true,
      hasParalysisPenalty: false,
    } as unknown as Inspection;

    jest.spyOn(service as any, 'persistNewInspection').mockResolvedValue(createdInspection);
    const paralyzeSpy = jest
      .spyOn(service, 'paralyze')
      .mockResolvedValue(createdInspection as any);

    inspectionsRepository.findOne.mockResolvedValueOnce(null);

    const result = await service.syncInspections(
      [
        {
          externalId: '31a9e29b-1ca9-4d69-a6cf-e6367471743a',
          module: ModuleType.QUALIDADE,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          serviceDescription: 'Vistoria offline',
          paralyze: {
            reason: 'Paralisada por chuva em campo',
          },
        },
      ] as any,
      'user-id',
      UserRole.FISCAL,
    );

    expect(paralyzeSpy).toHaveBeenCalledWith(
      'server-id-3',
      'Paralisada por chuva em campo',
      'user-id',
    );
    expect(result.results[0]).toMatchObject({
      externalId: '31a9e29b-1ca9-4d69-a6cf-e6367471743a',
      serverId: 'server-id-3',
      status: 'CREATED',
    });
  });

  it('deve permitir criar no sync ST sem serviceOrderId', async () => {
    const createdInspection = {
      id: 'server-id-st',
      status: 'RASCUNHO',
      module: ModuleType.SEGURANCA_TRABALHO,
      checklistId: 'checklist-id',
      teamId: 'team-id',
      serviceDescription: 'Vistoria ST',
      createdOffline: true,
      inspectionScope: InspectionScope.TEAM,
    } as unknown as Inspection;

    jest.spyOn(service as any, 'persistNewInspection').mockResolvedValue(createdInspection);
    inspectionsRepository.findOne.mockResolvedValueOnce(null);

    const result = await service.syncInspections(
      [
        {
          externalId: 'st-uuid-1',
          module: ModuleType.SEGURANCA_TRABALHO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceDescription: 'Vistoria ST',
          inspectionScope: InspectionScope.TEAM,
        },
      ] as any,
      'user-id',
      UserRole.FISCAL,
    );

    expect(result.results[0]).toMatchObject({
      externalId: 'st-uuid-1',
      serverId: 'server-id-st',
      status: 'CREATED',
    });
  });

  it('deve rejeitar criação no sync sem serviceOrderId quando módulo não é ST', async () => {
    inspectionsRepository.findOne.mockResolvedValueOnce(null);

    const result = await service.syncInspections(
      [
        {
          externalId: 'quality-uuid-1',
          module: ModuleType.QUALIDADE,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceDescription: 'Vistoria QLT',
        },
      ] as any,
      'user-id',
      UserRole.FISCAL,
    );

    expect(result.results[0]).toMatchObject({
      externalId: 'quality-uuid-1',
      status: 'ERROR',
      message:
        'serviceOrderId é obrigatório para criar nova vistoria. Cadastre a OS via importação de Excel antes de sincronizar.',
    });
  });

  it('deve permitir criação no sync REMOTO sem serviceDescription', async () => {
    const createdInspection = {
      id: 'server-id-remote',
      status: 'RASCUNHO',
      module: ModuleType.REMOTO,
      checklistId: 'checklist-id',
      teamId: 'team-id',
      serviceDescription: null,
      createdOffline: true,
      inspectionScope: InspectionScope.TEAM,
    } as unknown as Inspection;

    jest.spyOn(service as any, 'persistNewInspection').mockResolvedValue(createdInspection);
    inspectionsRepository.findOne.mockResolvedValueOnce(null);

    const result = await service.syncInspections(
      [
        {
          externalId: 'remote-uuid-1',
          module: ModuleType.REMOTO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          inspectionScope: InspectionScope.TEAM,
        },
      ] as any,
      'user-id',
      UserRole.FISCAL,
    );

    expect(result.results[0]).toMatchObject({
      externalId: 'remote-uuid-1',
      serverId: 'server-id-remote',
      status: 'CREATED',
    });
  });

  it('removeEvidence deve apagar asset no Cloudinary e o registro', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'i1',
      status: InspectionStatus.RASCUNHO,
      createdByUserId: 'u1',
    });
    evidencesRepository.findOne.mockResolvedValue({
      id: 'e1',
      inspectionId: 'i1',
      cloudinaryPublicId: 'quality/evidences/x',
    });
    assetStorageRegistry.deleteStoredAsset.mockResolvedValue(undefined);

    await service.removeEvidence('i1', 'e1', UserRole.FISCAL);

    expect(assetStorageRegistry.deleteStoredAsset).toHaveBeenCalledWith({
      id: 'e1',
      inspectionId: 'i1',
      cloudinaryPublicId: 'quality/evidences/x',
    });
    expect(evidencesRepository.delete).toHaveBeenCalledWith('e1');
  });

  it('removeEvidence deve ignorar Cloudinary quando não há publicId', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'i1',
      status: InspectionStatus.RASCUNHO,
      createdByUserId: 'u1',
    });
    evidencesRepository.findOne.mockResolvedValue({
      id: 'e1',
      inspectionId: 'i1',
      cloudinaryPublicId: null,
    });

    await service.removeEvidence('i1', 'e1', UserRole.GESTOR);

    expect(assetStorageRegistry.deleteStoredAsset).not.toHaveBeenCalled();
    expect(evidencesRepository.delete).toHaveBeenCalledWith('e1');
  });

  it('removeEvidence deve proibir FISCAL quando vistoria não está em RASCUNHO', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'i1',
      status: InspectionStatus.FINALIZADA,
      createdByUserId: 'u1',
    });

    await expect(
      service.removeEvidence('i1', 'e1', UserRole.FISCAL),
    ).rejects.toThrow(ForbiddenException);
  });

  it('remove deve apagar assets no Cloudinary antes de deletar vistoria', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'i1',
      status: InspectionStatus.RASCUNHO,
      module: ModuleType.CAMPO,
      serviceOrderId: null,
      teamId: null,
      serviceDescription: null,
      inspectionScope: InspectionScope.TEAM,
      hasParalysisPenalty: false,
    });
    evidencesRepository.find.mockResolvedValue([
      { cloudinaryPublicId: 'quality/evidences/a' },
      { cloudinaryPublicId: 'quality/evidences/a' },
      { cloudinaryPublicId: '  ' },
    ]);
    signaturesRepository.find.mockResolvedValue([
      { cloudinaryPublicId: 'quality/signatures/s1' },
      { cloudinaryPublicId: null },
    ]);
    assetStorageRegistry.deleteStoredAsset.mockResolvedValue(undefined);

    await service.remove('i1');

    expect(assetStorageRegistry.deleteStoredAsset).toHaveBeenCalledTimes(2);
    expect(assetStorageRegistry.deleteStoredAsset).toHaveBeenCalledWith({
      cloudinaryPublicId: 'quality/evidences/a',
    });
    expect(assetStorageRegistry.deleteStoredAsset).toHaveBeenCalledWith({
      cloudinaryPublicId: 'quality/signatures/s1',
    });
    expect(inspectionsRepository.delete).toHaveBeenCalledWith('i1');
  });

  it('findAll deve retornar DTO enxuto para listagem', async () => {
    const pendingQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          inspectionId: 'inspection-id',
          title: 'Extintor vencido',
          description: null,
        },
        {
          inspectionId: 'inspection-id',
          title: null,
          description: 'Sinalização de saída ausente',
        },
        {
          inspectionId: 'inspection-id',
          title: 'Quadro elétrico sem identificação',
          description: 'Descricao alternativa',
        },
        {
          inspectionId: 'inspection-id',
          title: null,
          description: null,
        },
      ]),
    };
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'inspection-id',
            externalId: null,
            module: ModuleType.CAMPO,
            serviceDescription: 'Servico',
            locationDescription: 'Local',
            status: InspectionStatus.FINALIZADA,
            hasParalysisPenalty: false,
            scorePercent: '98.5',
            finalizedAt: null,
            createdAt: new Date('2026-01-10T10:00:00.000Z'),
            team: { name: 'Equipe A' },
            serviceOrder: {
              osNumber: 'OS-1000',
              fimExecucao: new Date('2026-01-09T08:00:00.000Z'),
              resultado: 'EXECUTADO',
            },
            investmentWork: { id: 'iw-1', workName: 'Obra X' },
          },
        ],
        1,
      ]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);
    inspectionItemsRepository.createQueryBuilder.mockReturnValue(pendingQb);

    const response = await service.findAll({}, 1, 10, { role: UserRole.ADMIN });

    expect(response.meta.total).toBe(1);
    expect(response.data[0]).toEqual({
      externalId: 'inspection-id',
      module: ModuleType.CAMPO,
      evaluationModule: null,
      serviceDescription: 'Servico',
      locationDescription: 'Local',
      status: InspectionStatus.FINALIZADA,
      scorePercent: 98.5,
      hasParalysisPenalty: false,
      finalizedAt: null,
      createdAt: new Date('2026-01-10T10:00:00.000Z'),
      team: { name: 'Equipe A' },
      serviceOrder: {
        osNumber: 'OS-1000',
        fimExecucao: new Date('2026-01-09T08:00:00.000Z'),
        resultado: 'EXECUTADO',
      },
      investmentWork: { id: 'iw-1', name: 'Obra X', workName: 'Obra X' },
      pendingItemsCount: 4,
      pendingItemsPreview: [
        'Extintor vencido',
        'Sinalização de saída ausente',
        'Quadro elétrico sem identificação',
      ],
    });
    expect((response.data[0] as any).items).toBeUndefined();
    expect((response.data[0] as any).checklist).toBeUndefined();
    expect((response.data[0] as any).createdBy).toBeUndefined();
    expect((response.data[0] as any).collaborators).toBeUndefined();
  });

  it('findAll deve retornar pendências zeradas quando não houver itens pendentes', async () => {
    const pendingQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'inspection-id-2',
            externalId: 'ext-2',
            module: ModuleType.CAMPO,
            serviceDescription: null,
            locationDescription: null,
            status: InspectionStatus.PENDENTE_AJUSTE,
            hasParalysisPenalty: false,
            scorePercent: null,
            finalizedAt: null,
            createdAt: new Date('2026-01-10T10:00:00.000Z'),
            team: null,
            serviceOrder: null,
            investmentWork: null,
          },
        ],
        1,
      ]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);
    inspectionItemsRepository.createQueryBuilder.mockReturnValue(pendingQb);

    const response = await service.findAll({}, 1, 10, { role: UserRole.ADMIN });

    expect(response.data[0].pendingItemsCount).toBe(0);
    expect(response.data[0].pendingItemsPreview).toEqual([]);
  });

  it('findAll deve aplicar filtros de contrato, equipe, serviço e períodos', async () => {
    const pendingQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);
    inspectionItemsRepository.createQueryBuilder.mockReturnValue(pendingQb);

    await service.findAll(
      {
        contractId: 'contract-id',
        teamId: 'team-id',
        createdByUserId: 'fiscal-id',
        service: 'REPOSIÇÃO',
        executionFrom: '2026-05-01',
        executionTo: '2026-05-31',
        inspectionFrom: '2026-06-01',
        inspectionTo: '2026-06-30',
      },
      1,
      10,
      { role: UserRole.ADMIN },
    );

    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: 'team-id',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.createdByUserId = :createdByUserId',
      { createdByUserId: 'fiscal-id' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'inspection.contractId = :filterContractId',
      { filterContractId: 'contract-id' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'serviceOrder.resultado ILIKE :service',
      { service: '%REPOSIÇÃO%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      `DATE(timezone('America/Sao_Paulo', serviceOrder.fimExecucao)) >= :executionFrom`,
      { executionFrom: '2026-05-01' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      `DATE(timezone('America/Sao_Paulo', serviceOrder.fimExecucao)) <= :executionTo`,
      { executionTo: '2026-05-31' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      `DATE(timezone('America/Sao_Paulo', inspection.finalizedAt)) >= :inspectionFrom`,
      { inspectionFrom: '2026-06-01' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      `DATE(timezone('America/Sao_Paulo', inspection.finalizedAt)) <= :inspectionTo`,
      { inspectionTo: '2026-06-30' },
    );
  });

  it('findForExport deve reutilizar os filtros da listagem e limitar o volume', async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'inspection-id',
          externalId: 'ext-1',
          module: ModuleType.CAMPO,
          serviceDescription: 'Servico',
          locationDescription: 'Local',
          status: InspectionStatus.FINALIZADA,
          hasParalysisPenalty: false,
          scorePercent: 88,
          finalizedAt: null,
          createdAt: new Date('2026-01-10T10:00:00.000Z'),
          team: { name: 'Equipe A' },
          serviceOrder: null,
          investmentWork: null,
        },
      ]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);
    const pendingQb: any = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    inspectionItemsRepository.createQueryBuilder.mockReturnValue(pendingQb);

    const rows = await service.findForExport(
      { teamId: 'team-id', service: 'REPOSIÇÃO' },
      5000,
      { role: UserRole.ADMIN },
    );

    expect(qb.take).toHaveBeenCalledWith(5001);
    expect(qb.andWhere).toHaveBeenCalledWith('inspection.teamId = :teamId', {
      teamId: 'team-id',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].externalId).toBe('ext-1');
    expect(rows[0].pendingItemsCount).toBe(0);
    expect(inspectionItemsRepository.createQueryBuilder).toHaveBeenCalled();
  });

  it('findForExport deve recusar volume acima do limite', async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.findForExport({}, 2, { role: UserRole.ADMIN }),
    ).rejects.toThrow('A exportação ultrapassa o limite de 2 vistorias');
  });

  it('findMine deve retornar DTO enxuto para listagem do fiscal', async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'inspection-mine-id',
            externalId: 'external-id-1',
            module: ModuleType.REMOTO,
            serviceDescription: null,
            locationDescription: null,
            status: InspectionStatus.RASCUNHO,
            hasParalysisPenalty: true,
            scorePercent: null,
            finalizedAt: null,
            createdAt: new Date('2026-01-11T10:00:00.000Z'),
            team: null,
            serviceOrder: null,
            investmentWork: { id: 'iw-2', workName: 'Obra Y' },
          },
        ],
        1,
      ]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    const response = await service.findMine(
      'user-id',
      1,
      10,
      undefined,
      undefined,
      { role: UserRole.ADMIN },
    );

    expect(response.meta.total).toBe(1);
    expect(response.data[0]).toEqual({
      externalId: 'external-id-1',
      module: ModuleType.REMOTO,
      evaluationModule: null,
      serviceDescription: null,
      locationDescription: null,
      status: InspectionStatus.RASCUNHO,
      scorePercent: null,
      hasParalysisPenalty: true,
      finalizedAt: null,
      createdAt: new Date('2026-01-11T10:00:00.000Z'),
      team: null,
      serviceOrder: null,
      investmentWork: { id: 'iw-2', name: 'Obra Y', workName: 'Obra Y' },
      pendingItemsCount: 0,
      pendingItemsPreview: [],
    });
    expect((response.data[0] as any).id).toBeUndefined();
  });

  it('findMine deve paginar com skip/take e ignorar osNumber curto', async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.findMine(
      'user-id',
      3,
      50,
      '12',
      undefined,
      { role: UserRole.ADMIN },
    );

    expect(qb.skip).toHaveBeenCalledWith(100);
    expect(qb.take).toHaveBeenCalledWith(50);
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'serviceOrder.osNumber ILIKE :osNumber',
      expect.anything(),
    );
  });

  it('findMine deve filtrar osNumber com no mínimo 3 caracteres', async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    inspectionsRepository.createQueryBuilder.mockReturnValue(qb);

    await service.findMine(
      'user-id',
      1,
      10,
      'OS-9',
      undefined,
      { role: UserRole.ADMIN },
    );

    expect(qb.andWhere).toHaveBeenCalledWith(
      'serviceOrder.osNumber ILIKE :osNumber',
      { osNumber: '%OS-9%' },
    );
  });

  it('findOneDetail deve retornar checklistItem.description nos itens', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'inspection-id',
      externalId: 'ext-1',
      checklistId: 'checklist-1',
      createdByUserId: 'user-1',
      teamId: 'team-1',
      serviceOrderId: 'so-1',
      investmentWorkId: null,
      status: InspectionStatus.RASCUNHO,
      module: ModuleType.CAMPO,
      hasParalysisPenalty: false,
      serviceDescription: null,
      locationDescription: null,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      finalizedAt: null,
      updatedAt: new Date('2026-05-01T10:05:00.000Z'),
      scorePercent: null,
    });
    inspectionItemsRepository.find.mockResolvedValue([
      {
        id: 'item-1',
        checklistItemId: 'check-item-1',
        answer: ChecklistAnswer.CONFORME,
        notes: null,
        updatedAt: new Date('2026-05-01T10:01:00.000Z'),
        resolvedAt: new Date('2026-05-01T10:02:00.000Z'),
        resolvedByUserId: 'resolver-1',
        resolutionNotes: 'Ajustado em campo',
        resolutionEvidencePath: null,
      },
    ]);
    evidencesRepository.find.mockResolvedValue([]);
    signaturesRepository.find.mockResolvedValue([]);
    teamsRepository.findOne.mockResolvedValue({ name: 'Equipe A' });
    serviceOrderRepository.findOne.mockResolvedValue({
      osNumber: 'OS-001',
      fimExecucao: new Date('2026-04-30T18:00:00.000Z'),
    });
    checklistItemsRepository.find.mockResolvedValue([
      {
        id: 'check-item-1',
        title: 'Item de Checklist',
        description: 'Descricao do item',
      },
    ]);
    (service as any).checklistsRepository = {
      findOne: jest.fn().mockResolvedValue({ name: 'Checklist A' }),
    };
    dataSource.getRepository.mockImplementation((entity: any) => {
      if (entity === Inspection) return inspectionsRepository;
      return {
        findOne: jest.fn().mockResolvedValue({ name: 'Criador' }),
        find: jest.fn().mockResolvedValue([{ id: 'resolver-1', name: 'Joao' }]),
      };
    });

    const result = await service.findOneDetail('inspection-id');

    expect(result.items[0].checklistItem).toEqual({
      title: 'Item de Checklist',
      description: 'Descricao do item',
    });
    expect(result.items[0].resolvedAt).toEqual(
      new Date('2026-05-01T10:02:00.000Z'),
    );
    expect(result.items[0].resolvedBy).toEqual({ name: 'Joao' });
    expect(result.items[0].resolutionNotes).toBe('Ajustado em campo');
    expect(result.serviceOrder).toEqual({
      osNumber: 'OS-001',
      fimExecucao: new Date('2026-04-30T18:00:00.000Z'),
    });
  });

  it('findOneDetail deve retornar OS sem data de execução quando o campo não estiver salvo', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'inspection-id',
      externalId: 'ext-1',
      checklistId: 'checklist-1',
      createdByUserId: null,
      teamId: null,
      serviceOrderId: 'so-1',
      investmentWorkId: null,
      status: InspectionStatus.RASCUNHO,
      module: ModuleType.CAMPO,
      hasParalysisPenalty: false,
      serviceDescription: null,
      locationDescription: null,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      finalizedAt: null,
      updatedAt: new Date('2026-05-01T10:05:00.000Z'),
      scorePercent: null,
    });
    inspectionItemsRepository.find.mockResolvedValue([]);
    evidencesRepository.find.mockResolvedValue([]);
    signaturesRepository.find.mockResolvedValue([]);
    serviceOrderRepository.findOne.mockResolvedValue({
      osNumber: 'OS-002',
      fimExecucao: null,
    });
    checklistItemsRepository.find.mockResolvedValue([]);
    (service as any).checklistsRepository = {
      findOne: jest.fn().mockResolvedValue({ name: 'Checklist A' }),
    };
    dataSource.getRepository.mockImplementation((entity: any) => {
      if (entity === Inspection) return inspectionsRepository;
      return {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
      };
    });

    const result = await service.findOneDetail('inspection-id');

    expect(result.serviceOrder).toEqual({
      osNumber: 'OS-002',
      fimExecucao: null,
    });
  });

  it('presign de evidência deve recusar fiscal após finalização', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'insp-1',
      status: InspectionStatus.FINALIZADA,
      createdByUserId: 'user-1',
    });

    await expect(
      service.presignEvidenceUpload(
        'insp-1',
        { contentType: 'image/jpeg', contentLength: 1024 },
        UserRole.FISCAL,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('presign de evidência deve devolver modo proxy quando o storage não é S3', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'insp-1',
      status: InspectionStatus.RASCUNHO,
      createdByUserId: 'user-1',
    });
    assetStorage.createDirectUpload.mockResolvedValue({ mode: 'proxy' });

    const result = await service.presignEvidenceUpload(
      'insp-1',
      { contentType: 'image/jpeg', contentLength: 2048 },
      UserRole.FISCAL,
    );

    expect(result).toEqual({ mode: 'proxy' });
    expect(assetStorage.createDirectUpload).toHaveBeenCalledWith({
      folder: 'quality/evidences',
      contentType: 'image/jpeg',
      expiresInSeconds: 60,
    });
  });

  it('deve gravar evidência a partir do objeto já enviado ao S3', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'insp-1',
      status: InspectionStatus.RASCUNHO,
      createdByUserId: 'user-1',
    });
    const storageKey = 'quality/evidences/11111111-1111-1111-1111-111111111111.jpg';
    const publicUrl = `https://bucket.s3.sa-east-1.amazonaws.com/${storageKey}`;
    assetStorage.getPublicUrl.mockReturnValue(publicUrl);
    assetStorage.statObject.mockResolvedValue({
      contentLength: 1200,
      contentType: 'image/jpeg',
    });
    evidencesRepository.create.mockImplementation((payload: unknown) => payload);
    evidencesRepository.save.mockImplementation(async (payload: unknown) => ({
      id: 'ev-1',
      ...(payload as object),
    }));

    const result = await service.addEvidenceFromStorage(
      'insp-1',
      {
        storageKey,
        url: publicUrl,
        fileName: 'foto.jpg',
        mimeType: 'image/jpeg',
        bytes: 1200,
      },
      'user-1',
      UserRole.FISCAL,
    );

    expect(result.id).toBe('ev-1');
    expect(evidencesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        inspectionId: 'insp-1',
        storageKey,
        url: publicUrl,
        size: 1200,
      }),
    );
  });

  it('não deve confirmar evidência com storageKey fora do prefixo', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'insp-1',
      status: InspectionStatus.RASCUNHO,
      createdByUserId: 'user-1',
    });

    await expect(
      service.addEvidenceFromStorage(
        'insp-1',
        {
          storageKey: 'other/folder/file.jpg',
          url: 'https://bucket.s3.sa-east-1.amazonaws.com/other/folder/file.jpg',
          fileName: 'foto.jpg',
          mimeType: 'image/jpeg',
          bytes: 100,
        },
        'user-1',
        UserRole.FISCAL,
      ),
    ).rejects.toThrow('storageKey inválida');
  });
});
