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
  let dataSource: any;
  let cloudinaryService: {
    uploadImage: jest.Mock;
    uploadImageFromPath: jest.Mock;
    uploadImageStream: jest.Mock;
    deleteAsset: jest.Mock;
  };

  beforeEach(async () => {
    inspectionsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    inspectionItemsRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    evidencesRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    signaturesRepository = {
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
    };
    teamsRepository = {
      findOne: jest.fn(),
    };

    serviceOrderRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    cloudinaryService = {
      uploadImage: jest.fn(),
      uploadImageFromPath: jest.fn(),
      uploadImageStream: jest.fn(),
      deleteAsset: jest.fn(),
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
      teamsRepository as any,
      serviceOrderRepository as any,
      cloudinaryService as any,
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

    const createSpy = jest
      .spyOn(service, 'create')
      .mockResolvedValue(createdInspection);

    inspectionsRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...createdInspection,
        id: 'server-id-1',
      });

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

    expect(createSpy).toHaveBeenCalledTimes(1);
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

    jest.spyOn(service, 'create').mockResolvedValue(createdInspection);
    const paralyzeSpy = jest
      .spyOn(service, 'paralyze')
      .mockResolvedValue(createdInspection);

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

    jest.spyOn(service, 'create').mockResolvedValue(createdInspection);
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

    jest.spyOn(service, 'create').mockResolvedValue(createdInspection);
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
    cloudinaryService.deleteAsset.mockResolvedValue({ result: 'ok' });

    await service.removeEvidence('i1', 'e1', UserRole.FISCAL);

    expect(cloudinaryService.deleteAsset).toHaveBeenCalledWith(
      'quality/evidences/x',
    );
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

    expect(cloudinaryService.deleteAsset).not.toHaveBeenCalled();
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
});
