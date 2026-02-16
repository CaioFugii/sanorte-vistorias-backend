import { InspectionsService } from './inspections.service';
import {
  Inspection,
  InspectionItem,
  Evidence,
  Signature,
  PendingAdjustment,
  ChecklistItem,
} from '../entities';
import { ChecklistAnswer, ModuleType, UserRole } from '../common/enums';
import { InspectionDomainService } from './inspection-domain.service';

describe('InspectionsService', () => {
  let service: InspectionsService;
  let inspectionsRepository: any;
  let inspectionItemsRepository: any;
  let evidencesRepository: any;
  let signaturesRepository: any;
  let pendingAdjustmentsRepository: any;
  let checklistItemsRepository: any;

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

    const filesService = {
      saveEvidence: jest.fn(),
      saveSignature: jest.fn(),
    };

    const dataSource = {
      getRepository: jest.fn(),
    };

    service = new InspectionsService(
      inspectionsRepository as any,
      inspectionItemsRepository as any,
      evidencesRepository as any,
      signaturesRepository as any,
      pendingAdjustmentsRepository as any,
      checklistItemsRepository as any,
      filesService as any,
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
});
