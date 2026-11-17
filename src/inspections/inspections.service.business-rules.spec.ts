import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { Inspection, InspectionItem, PendingAdjustment } from '../entities';
import {
  InspectionStatus,
  ChecklistAnswer,
  UserRole,
  PendingStatus,
  ModuleType,
  InspectionScope,
  InvestmentWorkEvaluationModule,
  InvestmentWorkStatus,
} from '../common/enums';
import { InspectionDomainService } from './inspection-domain.service';
import { InspectionNoticesService } from '../inspection-notices/inspection-notices.service';
import { InspectionNoticeType } from '../common/enums';

describe('InspectionsService - Regras de Negócio', () => {
  let service: InspectionsService;
  let inspectionsRepository: any;
  let inspectionItemsRepository: any;
  let signaturesRepository: any;
  let pendingAdjustmentsRepository: any;
  let checklistItemsRepository: any;
  let evidencesRepository: any;
  let teamsRepository: any;
  let serviceOrderRepository: any;
  let investmentWorkRepository: any;
  let dataSource: any;
  let noticesRepository: any;
  let usersRepository: any;
  let noticeQueryBuilder: any;
  let inspectionNoticesService: InspectionNoticesService;

  const mockInspection: Partial<Inspection> = {
    id: 'test-id',
    module: ModuleType.QUALIDADE,
    teamId: 'team-id',
    serviceOrderId: 'service-order-id',
    serviceDescription: 'Vistoria padrão',
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
      count: jest.fn().mockResolvedValue(0),
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
      find: jest.fn().mockResolvedValue([]),
    };
    pendingAdjustmentsRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload: any) => payload),
      save: jest.fn(),
    };
    checklistItemsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    evidencesRepository = {
      count: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    teamsRepository = {
      findOne: jest.fn(),
    };

    serviceOrderRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'service-order-id',
        contractId: 'contract-id',
      }),
      update: jest.fn(),
    };
    investmentWorkRepository = {
      findOne: jest.fn(),
    };
    dataSource = { getRepository: jest.fn() };
    noticesRepository = {
      create: jest.fn((payload: any) => ({
        id: `notice-${payload.recipientUserId}`,
        ...payload,
      })),
      save: jest.fn(async (rows: any) => rows),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    noticeQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'gestor-1' }]),
    };
    usersRepository = {
      find: jest.fn().mockResolvedValue([{ id: 'admin-1' }]),
      createQueryBuilder: jest.fn(() => noticeQueryBuilder),
    };
    inspectionNoticesService = new InspectionNoticesService(
      noticesRepository,
      usersRepository,
    );

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
      {
        uploadImage: jest.fn(),
        uploadImageFromPath: jest.fn(),
        uploadImageStream: jest.fn(),
        createDirectUpload: jest.fn().mockResolvedValue({ mode: 'proxy' }),
        getPublicUrl: jest.fn().mockReturnValue(null),
        statObject: jest.fn().mockResolvedValue(null),
      } as any,
      { deleteStoredAsset: jest.fn() } as any,
      dataSource as any,
      new InspectionDomainService(),
      inspectionNoticesService,
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
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      status: InspectionStatus.RASCUNHO,
    } as any);

    await expect(
      service.remove('test-id', UserRole.FISCAL),
    ).resolves.toBeUndefined();

    expect(inspectionsRepository.delete).toHaveBeenCalledWith('test-id');
  });

  it('não deve excluir vistoria fora de RASCUNHO', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
    } as any);

    await expect(
      service.remove('test-id', UserRole.GESTOR),
    ).rejects.toThrow(BadRequestException);
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
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);

    await expect(
      service.update('test-id', {}, 'user-id', UserRole.GESTOR),
    ).resolves.not.toThrow();
  });

  it('ADMIN e GESTOR podem alterar evaluationModule em vistoria de Obras de Investimento', async () => {
    const inspection = {
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      status: InspectionStatus.FINALIZADA,
      evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
      serviceOrderId: null,
    };

    jest
      .spyOn(inspectionsRepository, 'findOne')
      .mockResolvedValue(inspection as Inspection);
    jest.spyOn(inspectionsRepository, 'update').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);

    for (const role of [UserRole.ADMIN, UserRole.GESTOR]) {
      await service.update(
        'test-id',
        { evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA } as any,
        'user-id',
        role,
      );
    }

    expect(inspectionsRepository.update).toHaveBeenCalledTimes(2);
    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA,
      }),
    );
  });

  it('SUPERVISOR não pode alterar evaluationModule', async () => {
    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue({
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      status: InspectionStatus.FINALIZADA,
      evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
      serviceOrderId: null,
    } as Inspection);

    await expect(
      service.update(
        'test-id',
        { evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA } as any,
        'user-id',
        UserRole.SUPERVISOR,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('FISCAL não pode alterar evaluationModule', async () => {
    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue({
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      status: InspectionStatus.RASCUNHO,
      evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
      serviceOrderId: null,
    } as Inspection);

    await expect(
      service.update(
        'test-id',
        { evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA } as any,
        'user-id',
        UserRole.FISCAL,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('deve rejeitar evaluationModule fora do módulo Obras de Investimento na edição', async () => {
    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue({
      ...mockInspection,
      module: ModuleType.CAMPO,
      status: InspectionStatus.FINALIZADA,
    } as Inspection);

    await expect(
      service.update(
        'test-id',
        { evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA } as any,
        'user-id',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(
      'evaluationModule só pode ser informado para o módulo OBRAS_INVESTIMENTO.',
    );
    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('deve rejeitar evaluationModule inválido na edição', async () => {
    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue({
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      status: InspectionStatus.FINALIZADA,
      evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
      serviceOrderId: null,
    } as Inspection);

    await expect(
      service.update(
        'test-id',
        { evaluationModule: 'REMOTO' } as any,
        'user-id',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow('evaluationModule deve ser CAMPO ou POS_OBRA');
    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('deve permitir editar teamId para equipe existente', async () => {
    jest.spyOn(inspectionsRepository, 'findOne').mockResolvedValue({
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
      teamId: 'team-old-id',
      collaborators: [],
    } as any);
    jest.spyOn(teamsRepository, 'findOne').mockResolvedValue({
      id: 'team-new-id',
      isContractor: false,
    });
    jest.spyOn(inspectionsRepository, 'update').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);

    await service.update(
      'test-id',
      { teamId: 'team-new-id' } as any,
      'user-id',
      UserRole.GESTOR,
    );

    expect(teamsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'team-new-id' },
      select: ['id'],
    });
    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ teamId: 'team-new-id' }),
    );
  });

  it('deve marcar vistoria como PENDENTE_AJUSTE quando houver NAO_CONFORME ao finalizar', async () => {
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);
    inspectionItemsRepository.find.mockImplementation((opts: any) => {
      if (opts?.where?.answer === ChecklistAnswer.NAO_CONFORME) {
        return Promise.resolve([
          { id: 'item-1', checklistItemId: 'check-item-1' },
        ]);
      }
      return Promise.resolve([
        { answer: ChecklistAnswer.NAO_CONFORME } as InspectionItem,
      ]);
    });
    checklistItemsRepository.find.mockResolvedValue([
      {
        id: 'check-item-1',
        title: 'Item de teste',
        requiresPhotoOnNonConformity: true,
      },
    ]);
    evidencesRepository.count.mockResolvedValue(1);
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

  it('deve gerar pendência em Segurança nova com não conformidade', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.SEGURANCA_TRABALHO,
    });
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);
    inspectionItemsRepository.find.mockImplementation((opts: any) => {
      if (opts?.where?.answer === ChecklistAnswer.NAO_CONFORME) {
        return Promise.resolve([
          { id: 'item-1', checklistItemId: 'check-item-1' },
        ]);
      }
      return Promise.resolve([
        { answer: ChecklistAnswer.NAO_CONFORME } as InspectionItem,
      ]);
    });
    checklistItemsRepository.find.mockResolvedValue([
      {
        id: 'check-item-1',
        title: 'Item de teste',
        requiresPhotoOnNonConformity: true,
      },
    ]);
    evidencesRepository.count.mockResolvedValue(1);

    await service.finalize('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        safetyPendingRule: true,
      }),
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalled();
  });

  it('não transforma Segurança antiga em pendência ao editar item', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.FINALIZADA,
      module: ModuleType.SEGURANCA_TRABALHO,
      evaluationModule: null,
      generatePending: null,
      safetyPendingRule: false,
      hasParalysisPenalty: false,
      paralysisPenaltyPercent: null,
    });
    inspectionItemsRepository.findOne.mockResolvedValue({
      id: 'item-1',
      inspectionId: 'test-id',
    } as InspectionItem);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.NAO_CONFORME },
    ] as InspectionItem[]);

    await service.updateItems(
      'test-id',
      [{ inspectionItemId: 'item-1', answer: ChecklistAnswer.NAO_CONFORME }],
      'gestor-id',
      UserRole.GESTOR,
    );

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.FINALIZADA,
      }),
    );
  });

  it('deve finalizar vistoria REMOTO mesmo com NAO_CONFORME e sem criar pendência', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.REMOTO,
    });
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);
    inspectionItemsRepository.find.mockImplementation((opts: any) => {
      if (opts?.where?.answer === ChecklistAnswer.NAO_CONFORME) {
        return Promise.resolve([
          { id: 'item-1', checklistItemId: 'check-item-1' },
        ]);
      }
      return Promise.resolve([
        { answer: ChecklistAnswer.NAO_CONFORME } as InspectionItem,
      ]);
    });
    checklistItemsRepository.find.mockResolvedValue([
      {
        id: 'check-item-1',
        title: 'Item de teste',
        requiresPhotoOnNonConformity: true,
      },
    ]);
    evidencesRepository.count.mockResolvedValue(1);

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
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);
    inspectionItemsRepository.find.mockImplementation((opts: any) => {
      if (opts?.where?.answer === ChecklistAnswer.NAO_CONFORME) {
        return Promise.resolve([]);
      }
      return Promise.resolve([
        { answer: ChecklistAnswer.CONFORME },
      ] as InspectionItem[]);
    });

    await service.finalize('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalled();
  });

  it('deve aplicar penalidade persistente no score ao atualizar itens', async () => {
    const inspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
      hasParalysisPenalty: true,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.FINALIZADA,
      module: ModuleType.QUALIDADE,
      hasParalysisPenalty: true,
      paralysisPenaltyPercent: 25,
    });
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

  it('deve aplicar 35% ao atualizar itens de paralisação nova', async () => {
    const inspection = {
      ...mockInspection,
      status: InspectionStatus.FINALIZADA,
      hasParalysisPenalty: true,
      paralysisPenaltyPercent: 35,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.FINALIZADA,
      module: ModuleType.QUALIDADE,
      hasParalysisPenalty: true,
      paralysisPenaltyPercent: 35,
    });
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
        scorePercent: 32.5,
      }),
    );
    expect(inspectionsRepository.update).not.toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        paralysisPenaltyPercent: 25,
      }),
    );
  });

  it('deve reavaliar status para FINALIZADA ao remover não conformidades (GESTOR/ADMIN)', async () => {
    const inspection = {
      ...mockInspection,
      status: InspectionStatus.PENDENTE_AJUSTE,
      hasParalysisPenalty: false,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.PENDENTE_AJUSTE,
      module: ModuleType.QUALIDADE,
      hasParalysisPenalty: false,
    });
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

  it('não deve reavaliar REMOTO para PENDENTE_AJUSTE ao atualizar itens', async () => {
    const inspection = {
      ...mockInspection,
      module: ModuleType.REMOTO,
      status: InspectionStatus.FINALIZADA,
      hasParalysisPenalty: false,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.FINALIZADA,
      module: ModuleType.REMOTO,
      hasParalysisPenalty: false,
    });
    jest.spyOn(service, 'findOne').mockResolvedValue(inspection);
    inspectionItemsRepository.findOne.mockResolvedValue({
      id: 'item-1',
      inspectionId: 'test-id',
    } as InspectionItem);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.NAO_CONFORME },
    ] as InspectionItem[]);

    await service.updateItems(
      'test-id',
      [{ inspectionItemId: 'item-1', answer: ChecklistAnswer.NAO_CONFORME }],
      'gestor-id',
      UserRole.GESTOR,
    );

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        scorePercent: 50,
        status: InspectionStatus.FINALIZADA,
      }),
    );
    expect(pendingAdjustmentsRepository.save).not.toHaveBeenCalled();
  });

  it('deve marcar paralisação e habilitar penalidade persistente', async () => {
    const activeInspection = {
      ...mockInspection,
      hasParalysisPenalty: false,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue(activeInspection);
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.NAO_CONFORME },
    ] as InspectionItem[]);

    await service.paralyze('test-id', '  Chuva intensa  ', 'gestor-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        hasParalysisPenalty: true,
        paralysisPenaltyPercent: 35,
        paralyzedReason: 'Chuva intensa',
        paralyzedByUserId: 'gestor-id',
        scorePercent: 32.5,
      }),
    );
  });

  it('não deve atualizar quando tentar paralisar vistoria já paralisada (idempotência)', async () => {
    const alreadyParalyzed = {
      ...mockInspection,
      hasParalysisPenalty: true,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue(alreadyParalyzed);
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);

    await service.paralyze('test-id', 'Motivo', 'gestor-id');

    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('unparalyze remove penalidade e recalcula nota', async () => {
    const paralyzedInspection = {
      ...mockInspection,
      hasParalysisPenalty: true,
    } as Inspection;

    inspectionsRepository.findOne.mockResolvedValue(paralyzedInspection);
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.CONFORME },
      { answer: ChecklistAnswer.CONFORME },
    ] as InspectionItem[]);

    await service.unparalyze('test-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        hasParalysisPenalty: false,
        paralysisPenaltyPercent: null,
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

    inspectionsRepository.findOne.mockResolvedValue(activeInspection);
    jest
      .spyOn(service, 'findOneDetail')
      .mockResolvedValue({ id: 'test-id' } as any);

    await service.unparalyze('test-id');

    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('deve permitir criar vistoria ST sem serviceOrderId e sem teamId', async () => {
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'inspection-st-id' });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({
      id: 'inspection-st-id',
      module: ModuleType.SEGURANCA_TRABALHO,
      inspectionScope: InspectionScope.TEAM,
    } as any);

    await expect(
      service.create(
        {
          module: ModuleType.SEGURANCA_TRABALHO,
          inspectionScope: InspectionScope.TEAM,
          checklistId: 'checklist-id',
          contractId: 'contract-id',
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

  it('deve gravar vistoria de Campo sem OS', async () => {
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'inspection-campo-id' });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({
      id: 'inspection-campo-id',
      module: ModuleType.CAMPO,
    } as any);

    await expect(
      service.create(
        {
          module: ModuleType.CAMPO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          contractId: 'contract-id',
          serviceDescription: 'Vistoria de campo sem OS',
        },
        'user-id',
      ),
    ).resolves.toMatchObject({ id: 'inspection-campo-id' });
    expect(serviceOrderRepository.update).not.toHaveBeenCalled();
  });

  it('deve rejeitar Campo sem equipe', async () => {
    await expect(
      service.create(
        {
          module: ModuleType.CAMPO,
          checklistId: 'checklist-id',
          contractId: 'contract-id',
          serviceDescription: 'Vistoria de campo sem equipe',
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'teamId é obrigatório para módulos diferentes de SEGURANCA_TRABALHO.',
    );
  });

  it('deve rejeitar pós-obra quando o resultado não exige a etapa', async () => {
    serviceOrderRepository.findOne.mockResolvedValue({
      id: 'service-order-id',
      contractId: 'contract-id',
      resultado: 'REPARO DE REDE DE AGUA',
    });

    await expect(
      service.create(
        {
          module: ModuleType.POS_OBRA,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          serviceDescription: 'Pós-obra',
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'O resultado desta ordem de serviço não exige vistoria de pós-obra.',
    );
    expect(inspectionsRepository.save).not.toHaveBeenCalled();
  });

  it('lista de pós-obra segue a mesma lista de resultado das caixas', async () => {
    const qb = {
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

    await service.findAll(
      { module: ModuleType.POS_OBRA },
      1,
      10,
      { role: UserRole.ADMIN },
    );

    const where = qb.andWhere.mock.calls.map((call) => String(call[0])).join('\n');
    expect(where).toContain('inspection.module <> :postWorkListModule');
    expect(where).toContain('postWorkEligibleResults');
    const params = qb.andWhere.mock.calls
      .map((call) => call[1])
      .find((value) => value?.postWorkListModule);
    expect(params.postWorkListModule).toBe(ModuleType.POS_OBRA);
    expect(params.postWorkEligibleResults).toEqual(
      expect.arrayContaining(['REPOSICAO DE ASFALTO']),
    );
    expect(params.postWorkEligibleResults).not.toContain(
      'COMPACTACAO E SELAGEM DA BASE',
    );
  });

  it('recusa segunda vistoria do mesmo módulo na mesma ordem de serviço', async () => {
    serviceOrderRepository.findOne.mockResolvedValue({
      id: 'service-order-id',
      contractId: 'contract-id',
      resultado: 'FIM DO DIA',
    });
    inspectionsRepository.count.mockResolvedValue(1);

    await expect(
      service.create(
        {
          module: ModuleType.REMOTO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
        },
        'outro-usuario',
      ),
    ).rejects.toThrow(
      'Esta ordem de serviço já tem vistoria de Remoto.',
    );
    expect(inspectionsRepository.save).not.toHaveBeenCalled();
  });

  it('deve gravar pós-obra quando o resultado está na lista e ligar o flag', async () => {
    serviceOrderRepository.findOne.mockResolvedValue({
      id: 'service-order-id',
      contractId: 'contract-id',
      resultado: 'reposição de asfalto',
    });
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'inspection-pos-id' });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({
      id: 'inspection-pos-id',
      module: ModuleType.POS_OBRA,
    } as any);

    await expect(
      service.create(
        {
          module: ModuleType.POS_OBRA,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          serviceDescription: 'Pós-obra',
        },
        'user-id',
      ),
    ).resolves.toMatchObject({ id: 'inspection-pos-id' });
    expect(serviceOrderRepository.update).toHaveBeenCalledWith(
      'service-order-id',
      { postWork: true },
    );
  });

  it('sync de Campo sem OS cria a vistoria e pós-obra inelegível volta erro', async () => {
    inspectionsRepository.findOne.mockResolvedValue(null);
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'synced-campo' });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });

    const created = await service.syncInspections(
      [
        {
          externalId: 'ext-campo',
          module: ModuleType.CAMPO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          contractId: 'contract-id',
          serviceDescription: 'Campo sincronizado',
        },
      ] as any,
      { id: 'user-id', role: UserRole.ADMIN },
    );
    expect(created.results[0]).toMatchObject({
      status: 'CREATED',
      serverId: 'synced-campo',
    });

    serviceOrderRepository.findOne.mockResolvedValue({
      id: 'service-order-id',
      contractId: 'contract-id',
      resultado: 'REPARO DE REDE DE AGUA',
    });
    const rejected = await service.syncInspections(
      [
        {
          externalId: 'ext-pos',
          module: ModuleType.POS_OBRA,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          serviceDescription: 'Pós-obra',
        },
      ] as any,
      { id: 'user-id', role: UserRole.ADMIN },
    );
    expect(rejected.results[0]).toMatchObject({
      status: 'ERROR',
      message:
        'O resultado desta ordem de serviço não exige vistoria de pós-obra.',
    });
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

  it('deve permitir criar vistoria REMOTO sem serviceDescription', async () => {
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({
      id: 'inspection-remote-id',
    });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({
      id: 'inspection-remote-id',
      module: ModuleType.REMOTO,
      inspectionScope: InspectionScope.TEAM,
      serviceDescription: null,
    } as any);

    await expect(
      service.create(
        {
          module: ModuleType.REMOTO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
        },
        'user-id',
      ),
    ).resolves.toMatchObject({
      id: 'inspection-remote-id',
      module: ModuleType.REMOTO,
    });
  });

  it('deve rejeitar criar vistoria sem serviceDescription quando módulo não é REMOTO', async () => {
    await expect(
      service.create(
        {
          module: ModuleType.SEGURANCA_TRABALHO,
          checklistId: 'checklist-id',
          contractId: 'contract-id',
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'serviceDescription é obrigatório para módulos diferentes de REMOTO.',
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
          contractId: 'contract-id',
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
          contractId: 'contract-id',
          serviceDescription: 'Vistoria ST colaborador',
          collaboratorIds: ['c-outsider'],
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'Todos os colaboradores informados devem existir na plataforma.',
    );
  });

  it('deve gravar evaluationModule CAMPO por padrão em vistoria de Obras de Investimento', async () => {
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'inspection-oi-id' });
    investmentWorkRepository.findOne.mockResolvedValue({
      id: 'iw-id',
      contractId: 'contract-id',
      active: true,
      status: InvestmentWorkStatus.EM_ANDAMENTO,
    });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({
      id: 'inspection-oi-id',
      module: ModuleType.OBRAS_INVESTIMENTO,
      evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
    } as any);

    await service.create(
      {
        module: ModuleType.OBRAS_INVESTIMENTO,
        checklistId: 'checklist-id',
        teamId: 'team-id',
        contractId: 'contract-id',
        investmentWorkId: 'iw-id',
        serviceDescription: 'Vistoria de obra',
      },
      'user-id',
    );

    expect(inspectionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
      }),
    );
  });

  it('deve gravar evaluationModule POS_OBRA quando informado em vistoria de Obras de Investimento', async () => {
    inspectionsRepository.create.mockImplementation((payload: any) => payload);
    inspectionsRepository.save.mockResolvedValue({ id: 'inspection-oi-id' });
    investmentWorkRepository.findOne.mockResolvedValue({
      id: 'iw-id',
      contractId: 'contract-id',
      active: true,
      status: InvestmentWorkStatus.EM_ANDAMENTO,
    });
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({
      id: 'inspection-oi-id',
      module: ModuleType.OBRAS_INVESTIMENTO,
      evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA,
    } as any);

    await service.create(
      {
        module: ModuleType.OBRAS_INVESTIMENTO,
        checklistId: 'checklist-id',
        teamId: 'team-id',
        contractId: 'contract-id',
        investmentWorkId: 'iw-id',
        evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA,
        serviceDescription: 'Vistoria de obra',
      },
      'user-id',
    );

    expect(inspectionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA,
      }),
    );
  });

  const mockNonConformItems = () => {
    inspectionItemsRepository.find.mockImplementation((opts: any) => {
      if (opts?.where?.answer === ChecklistAnswer.NAO_CONFORME) {
        return Promise.resolve([
          {
            id: 'item-1',
            checklistItemId: 'check-item-1',
            answer: ChecklistAnswer.NAO_CONFORME,
            resolvedAt: new Date(),
          },
        ]);
      }
      return Promise.resolve([
        { answer: ChecklistAnswer.NAO_CONFORME } as InspectionItem,
      ]);
    });
    checklistItemsRepository.find.mockResolvedValue([
      {
        id: 'check-item-1',
        title: 'Item de teste',
        requiresPhotoOnNonConformity: true,
      },
    ]);
    evidencesRepository.count.mockResolvedValue(1);
    pendingAdjustmentsRepository.findOne.mockResolvedValue(null);
    pendingAdjustmentsRepository.save.mockImplementation(async (value: any) => value);
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({ id: 'test-id' } as any);
  };

  it('Campo com não conformidade e generatePending false finaliza sem pendência', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.CAMPO,
      evaluationModule: null,
    });
    mockNonConformItems();

    await service.finalize('test-id', { generatePending: false });

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.FINALIZADA,
        generatePending: false,
      }),
    );
    expect(pendingAdjustmentsRepository.save).not.toHaveBeenCalled();
  });

  it('Campo com não conformidade e generatePending true fica PENDENTE_AJUSTE', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.CAMPO,
      evaluationModule: null,
    });
    mockNonConformItems();

    await service.finalize('test-id', { generatePending: true });

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        generatePending: true,
      }),
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalled();
  });

  it('Campo exige generatePending na finalização', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.CAMPO,
    });
    mockNonConformItems();

    await expect(service.finalize('test-id')).rejects.toThrow(BadRequestException);
    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('Pós-obra com não conformidade fica PENDENTE_AJUSTE sem o flag', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.POS_OBRA,
    });
    mockNonConformItems();

    await service.finalize('test-id', { generatePending: false });

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        generatePending: null,
      }),
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalled();
  });

  it('Obra de Investimento avaliada como Campo obedece generatePending', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
    });
    mockNonConformItems();

    await service.finalize('test-id', { generatePending: false });
    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.FINALIZADA,
        generatePending: false,
      }),
    );

    inspectionsRepository.update.mockClear();
    pendingAdjustmentsRepository.save.mockClear();
    await service.finalize('test-id', { generatePending: true });
    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        generatePending: true,
      }),
    );
  });

  it('Obra de Investimento avaliada como Pós-obra gera pendência e sem avaliação mantém o comportamento atual', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA,
    });
    mockNonConformItems();

    await service.finalize('test-id');
    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        generatePending: null,
      }),
    );

    inspectionsRepository.findOne.mockResolvedValue({
      ...mockInspection,
      module: ModuleType.OBRAS_INVESTIMENTO,
      evaluationModule: null,
    });
    inspectionsRepository.update.mockClear();
    await service.finalize('test-id');
    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        generatePending: null,
      }),
    );
  });

  it('não reabre Campo finalizada com generatePending false ao atualizar itens', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.FINALIZADA,
      module: ModuleType.CAMPO,
      evaluationModule: null,
      generatePending: false,
      hasParalysisPenalty: false,
      paralysisPenaltyPercent: null,
    });
    inspectionItemsRepository.findOne.mockResolvedValue({
      id: 'item-1',
      inspectionId: 'test-id',
    } as InspectionItem);
    inspectionItemsRepository.find.mockResolvedValue([
      { answer: ChecklistAnswer.NAO_CONFORME },
    ] as InspectionItem[]);

    await service.updateItems(
      'test-id',
      [{ inspectionItemId: 'item-1', answer: ChecklistAnswer.NAO_CONFORME }],
      'gestor-id',
      UserRole.GESTOR,
    );

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.FINALIZADA,
      }),
    );
    expect(pendingAdjustmentsRepository.save).not.toHaveBeenCalled();
  });

  it('Fiscal recebe 403 ao lançar resolução fora de Obras de Investimento e consegue quando é', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.PENDENTE_AJUSTE,
      module: ModuleType.CAMPO,
      contractId: 'contract-1',
    });

    await expect(
      service.resolve('test-id', {}, 'fiscal-id', UserRole.FISCAL),
    ).rejects.toThrow(ForbiddenException);

    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.PENDENTE_AJUSTE,
      module: ModuleType.OBRAS_INVESTIMENTO,
      contractId: 'contract-1',
    });
    inspectionItemsRepository.find.mockResolvedValue([
      {
        answer: ChecklistAnswer.NAO_CONFORME,
        resolvedAt: new Date(),
      },
    ]);
    pendingAdjustmentsRepository.findOne.mockResolvedValue({
      inspectionId: 'test-id',
      status: PendingStatus.PENDENTE,
    });
    pendingAdjustmentsRepository.save.mockImplementation(async (value: any) => value);
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({ id: 'test-id' } as any);

    await service.resolve('test-id', {}, 'fiscal-id', UserRole.FISCAL);

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.AGUARDANDO_APROVACAO,
        resolutionSubmittedByUserId: 'fiscal-id',
      }),
    );
  });

  it('Gestor não consegue lançar a resolução', async () => {
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.PENDENTE_AJUSTE,
      module: ModuleType.CAMPO,
      contractId: 'contract-1',
    });

    await expect(
      service.resolve('test-id', {}, 'gestor-id', UserRole.GESTOR),
    ).rejects.toThrow(ForbiddenException);
    expect(inspectionsRepository.update).not.toHaveBeenCalled();
  });

  it('Supervisor submete e Gestor aprova para RESOLVIDA, gravando notices', async () => {
    let persisted = false;
    noticesRepository.save.mockImplementation(async (rows: any) => {
      persisted = true;
      return rows;
    });
    const seen: boolean[] = [];
    const subscription = inspectionNoticesService.watch('gestor-1').subscribe(() => {
      seen.push(persisted);
    });

    inspectionsRepository.findOne.mockResolvedValueOnce({
      id: 'test-id',
      status: InspectionStatus.PENDENTE_AJUSTE,
      module: ModuleType.CAMPO,
      contractId: 'contract-1',
    });
    inspectionItemsRepository.find.mockResolvedValue([
      {
        answer: ChecklistAnswer.NAO_CONFORME,
        resolvedAt: new Date(),
      },
    ]);
    pendingAdjustmentsRepository.findOne.mockResolvedValue({
      inspectionId: 'test-id',
      status: PendingStatus.PENDENTE,
    });
    pendingAdjustmentsRepository.save.mockImplementation(async (value: any) => value);
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({ id: 'test-id' } as any);

    await service.resolve('test-id', {}, 'supervisor-id', UserRole.SUPERVISOR);

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.AGUARDANDO_APROVACAO,
        resolutionSubmittedByUserId: 'supervisor-id',
      }),
    );
    const submitted = noticesRepository.save.mock.calls[0][0];
    expect(submitted.map((notice: any) => notice.recipientUserId).sort()).toEqual([
      'admin-1',
      'gestor-1',
    ]);
    expect(submitted[0].type).toBe(InspectionNoticeType.RESOLUTION_SUBMITTED);
    expect(submitted[0].message).toContain('aprovação');
    expect(noticeQueryBuilder.andWhere).toHaveBeenCalledWith(
      'contract.id = :contractId',
      { contractId: 'contract-1' },
    );
    expect(seen).toEqual([true]);

    inspectionsRepository.findOne.mockResolvedValueOnce({
      id: 'test-id',
      status: InspectionStatus.AGUARDANDO_APROVACAO,
      module: ModuleType.CAMPO,
      contractId: 'contract-1',
      resolutionSubmittedByUserId: 'supervisor-id',
    });
    await service.approveResolution('test-id', 'gestor-id');

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.RESOLVIDA,
        resolutionRejectionReason: null,
      }),
    );
    const approved = noticesRepository.save.mock.calls.at(-1)[0];
    expect(approved).toEqual([
      expect.objectContaining({
        recipientUserId: 'supervisor-id',
        type: InspectionNoticeType.RESOLUTION_APPROVED,
      }),
    ]);
    subscription.unsubscribe();
  });

  it('vistoria sem contrato avisa só os admins', async () => {
    await inspectionNoticesService.notifyResolutionSubmitted({
      id: 'test-id',
      contractId: null,
    });

    expect(usersRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(noticesRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientUserId: 'admin-1',
        type: InspectionNoticeType.RESOLUTION_SUBMITTED,
      }),
    ]);
  });

  it('reprovar sem motivo retorna 400 e com motivo devolve a pendência preservando o autor', async () => {
    await expect(
      service.rejectResolution('test-id', '   ', 'gestor-id'),
    ).rejects.toThrow(BadRequestException);

    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.AGUARDANDO_APROVACAO,
      module: ModuleType.OBRAS_INVESTIMENTO,
      contractId: 'contract-1',
      resolutionSubmittedByUserId: 'fiscal-id',
    });
    pendingAdjustmentsRepository.findOne.mockResolvedValue({
      inspectionId: 'test-id',
      status: PendingStatus.PENDENTE,
      resolutionNotes: 'corrigido',
      resolutionEvidencePath: 'https://cdn.example/foto.jpg',
    });
    pendingAdjustmentsRepository.save.mockImplementation(async (value: any) => value);
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({ id: 'test-id' } as any);

    await service.rejectResolution('test-id', ' Foto ilegível ', 'gestor-id');

    const payload = inspectionsRepository.update.mock.calls.at(-1)[1];
    expect(payload).toEqual(
      expect.objectContaining({
        status: InspectionStatus.PENDENTE_AJUSTE,
        resolutionRejectionReason: 'Foto ilegível',
        resolutionSubmittedAt: null,
        resolutionRejectedByUserId: 'gestor-id',
      }),
    );
    expect(payload).not.toHaveProperty('resolutionSubmittedByUserId');
    expect(inspectionItemsRepository.save).not.toHaveBeenCalled();
    expect(inspectionItemsRepository.update).toHaveBeenCalledWith(
      {
        inspectionId: 'test-id',
        answer: ChecklistAnswer.NAO_CONFORME,
      },
      {
        resolvedAt: null,
        resolvedByUserId: null,
      },
    );
    expect(pendingAdjustmentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resolutionNotes: 'corrigido',
        resolutionEvidencePath: 'https://cdn.example/foto.jpg',
      }),
    );
    expect(noticesRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientUserId: 'fiscal-id',
        type: InspectionNoticeType.RESOLUTION_REJECTED,
        message: expect.stringContaining('Foto ilegível'),
      }),
    ]);
  });

  it('depois da recusa o item volta a pendente e o novo lançamento preserva a foto', async () => {
    const item = {
      id: 'item-1',
      inspectionId: 'test-id',
      answer: ChecklistAnswer.NAO_CONFORME,
      resolvedAt: null,
      resolutionNotes: 'TESTE',
      resolutionEvidencePath: 'https://cdn.example/foto.jpg',
    };
    inspectionsRepository.findOne.mockResolvedValue({
      id: 'test-id',
      status: InspectionStatus.PENDENTE_AJUSTE,
      module: ModuleType.CAMPO,
      contractId: 'contract-1',
      resolutionSubmittedByUserId: 'supervisor-id',
      resolutionRejectionReason: 'Foto ilegível',
    });
    inspectionItemsRepository.findOne
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce({
        ...item,
        resolutionNotes: 'Ajustado',
        checklistItem: null,
        resolvedBy: null,
      });
    inspectionItemsRepository.save.mockImplementation(async (value: any) => value);

    await service.resolveItem(
      'test-id',
      'item-1',
      { resolutionNotes: 'Ajustado' },
      'supervisor-id',
      UserRole.SUPERVISOR,
    );

    expect(inspectionItemsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resolutionNotes: 'Ajustado',
        resolutionEvidencePath: 'https://cdn.example/foto.jpg',
        resolvedByUserId: 'supervisor-id',
      }),
    );

    inspectionItemsRepository.find.mockResolvedValue([
      {
        answer: ChecklistAnswer.NAO_CONFORME,
        resolvedAt: new Date(),
      },
    ]);
    pendingAdjustmentsRepository.findOne.mockResolvedValue({
      inspectionId: 'test-id',
      status: PendingStatus.PENDENTE,
    });
    pendingAdjustmentsRepository.save.mockImplementation(async (value: any) => value);
    jest.spyOn(service, 'findOneDetail').mockResolvedValue({ id: 'test-id' } as any);

    await service.resolve('test-id', {}, 'supervisor-id', UserRole.SUPERVISOR);

    expect(inspectionsRepository.update).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        status: InspectionStatus.AGUARDANDO_APROVACAO,
        resolutionSubmittedByUserId: 'supervisor-id',
        resolutionRejectionReason: null,
      }),
    );
  });

  it('deve rejeitar evaluationModule fora do módulo Obras de Investimento', async () => {
    await expect(
      service.create(
        {
          module: ModuleType.CAMPO,
          checklistId: 'checklist-id',
          teamId: 'team-id',
          serviceOrderId: 'service-order-id',
          evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
          serviceDescription: 'Vistoria de campo',
        },
        'user-id',
      ),
    ).rejects.toThrow(
      'evaluationModule só pode ser informado para o módulo OBRAS_INVESTIMENTO.',
    );
  });
});
