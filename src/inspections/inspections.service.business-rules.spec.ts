import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import {
  Inspection,
  InspectionItem,
  Evidence,
  Signature,
  PendingAdjustment,
  ChecklistItem,
} from '../entities';
import {
  InspectionStatus,
  ChecklistAnswer,
  UserRole,
  PendingStatus,
} from '../common/enums';
import { InspectionDomainService } from './inspection-domain.service';

describe('InspectionsService - Regras de Negócio', () => {
  let service: InspectionsService;
  let inspectionsRepository: any;
  let inspectionItemsRepository: any;
  let signaturesRepository: any;
  let pendingAdjustmentsRepository: any;
  let checklistItemsRepository: any;

  const mockInspection: Partial<Inspection> = {
    id: 'test-id',
    status: InspectionStatus.RASCUNHO,
    createdByUserId: 'user-id',
  };

  beforeEach(async () => {
    inspectionsRepository = {
      findOne: jest.fn().mockResolvedValue(mockInspection),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
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
    signaturesRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    pendingAdjustmentsRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload: any) => payload),
      save: jest.fn(),
    };
    checklistItemsRepository = {
      findOne: jest.fn(),
    };

    service = new InspectionsService(
      inspectionsRepository as any,
      inspectionItemsRepository as any,
      {} as any,
      signaturesRepository as any,
      pendingAdjustmentsRepository as any,
      checklistItemsRepository as any,
      { uploadImage: jest.fn() } as any,
      { getRepository: jest.fn() } as any,
      new InspectionDomainService(),
    );
  });

  it('FISCAL não deve editar vistoria finalizada', async () => {
    const finalizedInspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    };

    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue(finalizedInspection as Inspection);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.FISCAL),
    ).rejects.toThrow(ForbiddenException);
  });

  it('GESTOR deve poder editar vistoria finalizada', async () => {
    const finalizedInspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    };

    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue(finalizedInspection as Inspection);
    jest.spyOn(inspectionsRepository, 'update').mockResolvedValue(undefined);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.GESTOR),
    ).resolves.not.toThrow();
  });

  it('deve marcar vistoria como PENDENTE_AJUSTE quando houver NAO_CONFORME ao finalizar', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(mockInspection as Inspection);
    signaturesRepository.findOne.mockResolvedValue({
      id: 'sig-id',
      inspectionId: 'test-id',
    } as Signature);
    inspectionItemsRepository.find.mockResolvedValue([
      {
        id: 'item-1',
        inspectionId: 'test-id',
        checklistItemId: 'check-item-1',
        answer: ChecklistAnswer.NAO_CONFORME,
        evidences: [{ id: 'ev-1' }],
      } as InspectionItem,
    ]);
    checklistItemsRepository.findOne.mockResolvedValue({
      id: 'check-item-1',
      title: 'Item de teste',
      requiresPhotoOnNonConformity: true,
    } as ChecklistItem);
    pendingAdjustmentsRepository.findOne.mockResolvedValue(null);
    pendingAdjustmentsRepository.save.mockResolvedValue({
      id: 'pending-id',
      status: PendingStatus.PENDENTE,
    } as PendingAdjustment);

    await service.finalize('test-id', 'user-id', UserRole.FISCAL);

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
      }),
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalled();
  });

  it('deve exigir assinatura para finalizar', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue(mockInspection as Inspection);
    signaturesRepository.findOne.mockResolvedValue(null);

    await expect(
      service.finalize('test-id', 'user-id', UserRole.FISCAL),
    ).rejects.toThrow(BadRequestException);
  });
});
