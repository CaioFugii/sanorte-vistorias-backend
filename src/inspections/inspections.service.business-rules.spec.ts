import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import {
  Inspection,
  InspectionItem,
  Signature,
  PendingAdjustment,
  ChecklistItem,
} from '../entities';
import {
  InspectionStatus,
  ChecklistAnswer,
  UserRole,
  PendingStatus,
  ModuleType,
  InspectionScope,
} from '../common/enums';
import { InspectionDomainService } from './inspection-domain.service';

describe('InspectionsService - Regras de Negócio', () => {
  let service: InspectionsService;
  let inspectionsRepository: any;
  let inspectionItemsRepository: any;
  let signaturesRepository: any;
  let pendingAdjustmentsRepository: any;
  let checklistItemsRepository: any;
  let teamsRepository: any;
  let serviceOrderRepository: any;
  let dataSource: any;

  const mockInspection: Partial<Inspection> = {
    id: 'test-id',
    module: ModuleType.QUALIDADE,
    teamId: 'team-id',
    serviceOrderId: 'service-order-id',
    status: InspectionStatus.RASCUNHO,
    createdByUserId: 'user-id',
    hasParalysisPenalty: false,
  };

  beforeEach(async () => {
    inspectionsRepository = {
      findOne: jest.fn().mockResolvedValue(mockInspection),
      update: jest.fn(),
      delete: jest.fn(),
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
    teamsRepository = {
      findOne: jest.fn(),
    };

    serviceOrderRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'service-order-id' }),
      update: jest.fn(),
    };
    dataSource = { getRepository: jest.fn() };

    service = new InspectionsService(
      inspectionsRepository as any,
      inspectionItemsRepository as any,
      {} as any,
      signaturesRepository as any,
      pendingAdjustmentsRepository as any,
      checklistItemsRepository as any,
      teamsRepository as any,
      serviceOrderRepository as any,
      { uploadImage: jest.fn() } as any,
      dataSource as any,
      new InspectionDomainService(),
    );
  });

  it('FISCAL não deve editar vistoria finalizada', async () => {
    const finalizedInspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    };

    jest
      .spyOn(inspectionsRepository, 'findOne')
      .mockResolvedValue(finalizedInspection as Inspection);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.FISCAL),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deve excluir vistoria em RASCUNHO', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      ...mockInspection,
      status: InspectionStatus.RASCUNHO,
    } as Inspection);

    await expect(service.remove('test-id')).resolves.toBeUndefined();

    expect(inspectionsRepository.delete).toHaveBeenCalledWith('test-id');
  });

  it('não deve excluir vistoria fora de RASCUNHO', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    } as Inspection);

    await expect(service.remove('test-id')).rejects.toThrow(BadRequestException);
    expect(inspectionsRepository.delete).not.toHaveBeenCalled();
  });

  it('GESTOR deve poder editar vistoria finalizada', async () => {
    const finalizedInspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    };

    jest
      .spyOn(inspectionsRepository, 'findOne')
      .mockResolvedValue(finalizedInspection as Inspection);
    jest.spyOn(inspectionsRepository, 'update').mockResolvedValue(undefined);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.GESTOR),
    ).resolves.not.toThrow();
  });

  it('deve marcar vistoria como PENDENTE_AJUSTE quando houver NAO_CONFORME ao finalizar', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(mockInspection as Inspection);
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

    await service.finalize('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
      }),
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalled();
  });

  it('deve finalizar vistoria ST mesmo com NAO_CONFORME e sem criar pendência', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({
      ...mockInspection,
      module: ModuleType.SEGURANCA_TRABALHO,
    } as Inspection);
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

    await service.finalize('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.FINALIZADA,
      }),
    );
    expect(pendingAdjustmentsRepository.save).not.toHaveBeenCalled();
  });

  it('deve permitir finalizar sem assinatura (assinatura é opcional)', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(mockInspection as Inspection);
    signaturesRepository.findOne.mockResolvedValue(null);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
    ] as InspectionItem[]);

    await service.finalize('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalled();
  });

  it('deve aplicar penalidade persistente no score ao atualizar itens', async () => {
    const inspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
      hasParalysisPenalty: true,
    } as Inspection;

    jest.spyOn(service, 'findOne').mockResolvedValue(inspection);
    inspectionItemsRepository.findOne.mockResolvedValue({
      id: 'item-1',
      inspectionId: 'test-id',
    } as InspectionItem);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.NAO_CONFORME },
    ] as InspectionItem[]);
    pendingAdjustmentsRepository.findOne.mockResolvedValue({
      inspectionId: 'test-id',
      status: PendingStatus.PENDENTE,
    } as PendingAdjustment);

    await service.updateItems(
      'test-id',
      [{ inspectionItemId: 'item-1', answer: ChecklistAnswer.CONFORME }],
      'gestor-id',
      UserRole.GESTOR,
    );

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        scorePercent: 37.5,
        status: InspectionStatus.PENDENTE_AJUSTE,
      }),
    );
  });

  it('deve reavaliar status para FINALIZADA ao remover não conformidades (GESTOR/ADMIN)', async () => {
    const inspection = {
      ...mockInspection,
      status: InspectionStatus.PENDENTE_AJUSTE,
      hasParalysisPenalty: false,
    } as Inspection;

    jest.spyOn(service, 'findOne').mockResolvedValue(inspection);
    inspectionItemsRepository.findOne.mockResolvedValue({
      id: 'item-1',
      inspectionId: 'test-id',
    } as InspectionItem);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.CONFORME },
    ] as InspectionItem[]);
    pendingAdjustmentsRepository.findOne.mockResolvedValue({
      inspectionId: 'test-id',
      status: PendingStatus.PENDENTE,
    } as PendingAdjustment);

    await service.updateItems(
      'test-id',
      [{ inspectionItemId: 'item-1', answer: ChecklistAnswer.CONFORME }],
      'admin-id',
      UserRole.ADMIN,
    );

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        scorePercent: 100,
        status: InspectionStatus.FINALIZADA,
      }),
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PendingStatus.RESOLVIDA,
        resolvedByUserId: 'admin-id',
      }),
    );
  });

  it('deve marcar paralisação e habilitar penalidade persistente', async () => {
    const activeInspection = {
      ...mockInspection,
      hasParalysisPenalty: false,
    } as Inspection;
    const paralyzedInspection = {
      ...activeInspection,
      hasParalysisPenalty: true,
    } as Inspection;

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValueOnce(activeInspection)
      .mockResolvedValueOnce(paralyzedInspection);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.NAO_CONFORME },
    ] as InspectionItem[]);

    await service.paralyze('test-id', '  Chuva intensa  ', 'gestor-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        hasParalysisPenalty: true,
        paralyzedReason: 'Chuva intensa',
        paralyzedByUserId: 'gestor-id',
        scorePercent: 37.5,
      }),
    );
  });

  it('não deve atualizar quando tentar paralisar vistoria já paralisada (idempotência)', async () => {
    const alreadyParalyzed = {
      ...mockInspection,
      hasParalysisPenalty: true,
    } as Inspection;

    jest.spyOn(service, 'findOne').mockResolvedValue(alreadyParalyzed);

    await service.paralyze('test-id', 'Motivo', 'gestor-id');

    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('unparalyze remove penalidade e recalcula nota', async () => {
    const paralyzedInspection = {
      ...mockInspection,
      hasParalysisPenalty: true,
    } as Inspection;
    const unparalyzedInspection = {
      ...mockInspection,
      hasParalysisPenalty: false,
    } as Inspection;

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValueOnce(paralyzedInspection)
      .mockResolvedValueOnce(unparalyzedInspection);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.CONFORME },
    ] as InspectionItem[]);

    await service.unparalyze('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        hasParalysisPenalty: false,
        paralyzedReason: null,
        paralyzedAt: null,
        paralyzedByUserId: null,
        scorePercent: 100,
      }),
    );
  });

  it('unparalyze é idempotente quando vistoria não tem penalidade', async () => {
    const activeInspection = {
      ...mockInspection,
      hasParalysisPenalty: false,
    } as Inspection;

    jest.spyOn(service, 'findOne').mockResolvedValue(activeInspection);

    await service.unparalyze('test-id');

    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('deve permitir criar vistoria ST sem serviceOrderId e sem teamId', async () => {
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'inspection-st-id' });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'inspection-st-id',
      module: ModuleType.SEGURANCA_TRABALHO,
      inspectionScope: InspectionScope.TEAM,
    } as Inspection);

    await expect(
      service.create(
        {
          module: ModuleType.SEGURANCA_TRABALHO,
          inspectionScope: InspectionScope.TEAM,
          checklistId: 'checklist-id',
          serviceDescription: 'Vistoria ST sem OS',
        },
        'user-id',
      ),
    ).resolves.toMatchObject({
      id: 'inspection-st-id',
      module: ModuleType.SEGURANCA_TRABALHO,
    });
  });

  it('deve rejeitar criar vistoria sem serviceOrderId quando módulo não é ST', async () => {
    await expect(
      service.create(
        {
          module: ModuleType.QUALIDADE,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceDescription: 'Vistoria sem OS',
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'serviceOrderId é obrigatório. Informe uma OS válida cadastrada na tabela de ordens de serviço.',
    );
  });

  it('deve rejeitar criar vistoria sem teamId quando módulo não é ST', async () => {
    await expect(
      service.create(
        {
          module: ModuleType.QUALIDADE,
          checklistId: 'checklist-id',
          serviceOrderId: 'service-order-id',
          serviceDescription: 'Vistoria sem equipe',
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'teamId é obrigatório para módulos diferentes de SEGURANCA_TRABALHO.',
    );
  });

  it('deve exigir exatamente 1 colaborador na vistoria ST por colaborador', async () => {
    teamsRepository.findOne.mockResolvedValue({
      id: 'team-id',
      isContractor: false,
    });

    await expect(
      service.create(
        {
          module: ModuleType.SEGURANCA_TRABALHO,
          inspectionScope: InspectionScope.COLLABORATOR,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceDescription: 'Vistoria ST colaborador',
          collaboratorIds: ['c-1', 'c-2'],
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'Vistoria de Segurança do Trabalho por colaborador exige exatamente 1 colaborador.',
    );
  });

  it('deve validar que colaborador alvo existe na plataforma na vistoria ST por colaborador', async () => {
    teamsRepository.findOne.mockResolvedValue({
      id: 'team-id',
      isContractor: false,
    });
    dataSource.getRepository.mockReturnValue({
      findBy: jest.fn().mockResolvedValue([]),
    });

    await expect(
      service.create(
        {
          module: ModuleType.SEGURANCA_TRABALHO,
          inspectionScope: InspectionScope.COLLABORATOR,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceDescription: 'Vistoria ST colaborador',
          collaboratorIds: ['c-outsider'],
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'Todos os colaboradores informados devem existir na plataforma.',
    );
  });
});
