import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../common/enums';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ServiceOrder } from '../entities';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';
import {
  monthDateRange,
  previousYearMonth,
  saoPauloYearMonth,
} from './service-order-periods';

describe('ServiceOrdersService.remove', () => {
  let service: ServiceOrdersService;
  let serviceOrderRepository: {
    find: jest.Mock;
    delete: jest.Mock;
  };
  let inspectionsService: {
    remove: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      find: jest.Mock;
      delete: jest.Mock;
    };
  };
  let dataSource: {
    createQueryRunner: jest.Mock;
  };

  beforeEach(() => {
    serviceOrderRepository = {
      find: jest.fn(),
      delete: jest.fn(),
    };
    inspectionsService = {
      remove: jest.fn().mockResolvedValue(undefined),
    };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        find: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      inspectionsService as any,
    );
  });

  it('apaga a OS e a vistoria finalizada, pedindo o arquivo antes da linha', async () => {
    serviceOrderRepository.find.mockResolvedValue([
      { id: 'so-1', osNumber: '100' },
      { id: 'so-2', osNumber: '200' },
    ]);
    queryRunner.manager.find.mockImplementation(async (_entity, options) => {
      if (options.where.serviceOrderId === 'so-2') {
        return [{ id: 'insp-1' }];
      }
      return [];
    });

    await service.removeMany(['so-1', 'so-2']);

    expect(inspectionsService.remove).toHaveBeenCalledTimes(1);
    expect(inspectionsService.remove).toHaveBeenCalledWith(
      'insp-1',
      UserRole.ADMIN,
      queryRunner.manager,
    );
    expect(queryRunner.manager.delete).toHaveBeenCalledWith(ServiceOrder, 'so-1');
    expect(queryRunner.manager.delete).toHaveBeenCalledWith(ServiceOrder, 'so-2');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('não apaga nenhuma OS quando um id não existe', async () => {
    serviceOrderRepository.find.mockResolvedValue([{ id: 'so-1', osNumber: '100' }]);

    await expect(service.removeMany(['so-1', 'so-missing'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(inspectionsService.remove).not.toHaveBeenCalled();
    expect(queryRunner.manager.delete).not.toHaveBeenCalled();
  });

  it('desfaz o lote quando a foto de uma vistoria não sai', async () => {
    serviceOrderRepository.find.mockResolvedValue([
      { id: 'so-1', osNumber: '100' },
      { id: 'so-2', osNumber: '200' },
    ]);
    queryRunner.manager.find.mockImplementation(async (_entity, options) => {
      if (options.where.serviceOrderId === 'so-2') return [{ id: 'insp-2' }];
      return [];
    });
    inspectionsService.remove.mockRejectedValue(new Error('storage down'));

    await expect(service.removeMany(['so-1', 'so-2'])).rejects.toThrow(
      'A exclusão parou na OS 200. storage down',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('DELETE de uma OS com vistoria segue a mesma rotina', async () => {
    serviceOrderRepository.find.mockResolvedValue([{ id: 'so-1', osNumber: '100' }]);
    queryRunner.manager.find.mockResolvedValue([{ id: 'insp-1' }]);

    await service.remove('so-1');

    expect(inspectionsService.remove).toHaveBeenCalledWith(
      'insp-1',
      UserRole.ADMIN,
      queryRunner.manager,
    );
    expect(queryRunner.manager.delete).toHaveBeenCalledWith(ServiceOrder, 'so-1');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('lista vazia responde 400', async () => {
    await expect(service.removeMany([])).rejects.toBeInstanceOf(BadRequestException);
    expect(serviceOrderRepository.find).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando ordem de serviço não existe', async () => {
    serviceOrderRepository.find.mockResolvedValue([]);

    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});

describe('ServiceOrdersController exclusão', () => {
  it('lote e exclusão unitária são só de ADMIN', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ServiceOrdersController.prototype.bulkDelete),
    ).toEqual([UserRole.ADMIN]);
    expect(
      Reflect.getMetadata(ROLES_KEY, ServiceOrdersController.prototype.remove),
    ).toEqual([UserRole.ADMIN]);
  });

  it('gestor não passa no guard e a API responde 403', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as any);
    const context = {
      getHandler: () => ServiceOrdersController.prototype.bulkDelete,
      getClass: () => ServiceOrdersController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.GESTOR } }),
      }),
    };

    expect(guard.canActivate(context as any)).toBe(false);
  });
});

describe('ServiceOrdersService.findAll', () => {
  let service: ServiceOrdersService;
  let qb: {
    leftJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    addSelect: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    orderBy: jest.Mock;
    clone: jest.Mock;
    getCount: jest.Mock;
    getRawAndEntities: jest.Mock;
  };
  let serviceOrderRepository: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
    };
    qb.clone.mockReturnValue(qb);
    serviceOrderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('aplica filtros de equipe PDA e resultado', async () => {
    await service.findAll(
      { role: 'ADMIN' },
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'PDA 01',
      'EXECUTADO',
    );

    expect(qb.andWhere).toHaveBeenCalledWith(
      'serviceOrder.equipe ILIKE :equipe',
      { equipe: '%PDA 01%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'serviceOrder.resultado ILIKE :resultado',
      { resultado: '%EXECUTADO%' },
    );
  });

  it('ignora equipe e resultado vazios ou com menos de 3 caracteres', async () => {
    await service.findAll(
      { role: 'ADMIN' },
      1,
      10,
      '12',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'ab',
      'x',
    );

    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'serviceOrder.osNumber ILIKE :osNumber',
      expect.anything(),
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'serviceOrder.equipe ILIKE :equipe',
      expect.anything(),
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'serviceOrder.resultado ILIKE :resultado',
      expect.anything(),
    );
  });

  it('filtra pós-obra pela existência da vistoria, não pela coluna', async () => {
    await service.findAll(
      { role: 'ADMIN' },
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );

    const sql = qb.andWhere.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('postWorkModule');
    expect(sql).not.toContain('serviceOrder.postWork =');
  });

  it('marca pós-obra exigida e feita a partir da vistoria, mesmo com a coluna falsa', async () => {
    const order = {
      id: 'so-1',
      resultado: 'REPOSIÇÃO DE ASFALTO',
      field: false,
      remote: false,
      postWork: false,
    };
    qb.getCount.mockResolvedValue(1);
    qb.getRawAndEntities.mockResolvedValue({
      entities: [order],
      raw: [{ inspectionCount: 3 }],
    });
    const inspectionRepository = {
      manager: {
        query: jest.fn().mockResolvedValue([
          { serviceOrderId: 'so-1', module: 'POS_OBRA' },
        ]),
      },
    };
    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      {} as any,
      {} as any,
      inspectionRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll({ role: 'ADMIN' }, 1, 10);

    expect(result.data[0]).toMatchObject({
      postWork: true,
      postWorkRequired: true,
      field: false,
      remote: false,
      inspectionCount: 3,
    });
    expect(qb.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('inspection_count.service_order_id'),
      'inspectionCount',
    );
  });
});

describe('ServiceOrdersService.findForExport', () => {
  let service: ServiceOrdersService;
  let qb: {
    leftJoin: jest.Mock;
    select: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };
  let serviceOrderRepository: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ osNumber: 'OS-1' }]),
    };
    serviceOrderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('aplica os mesmos filtros da listagem e limita a quantidade', async () => {
    const rows = await service.findForExport(
      { role: 'ADMIN' },
      { equipe: 'PDA 01', from: '2026-08-01', to: '2026-08-31' },
      2,
    );

    expect(rows).toEqual([
      {
        osNumber: 'OS-1',
        field: false,
        remote: false,
        postWork: false,
        postWorkRequired: false,
      },
    ]);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'serviceOrder.equipe ILIKE :equipe',
      { equipe: '%PDA 01%' },
    );
    expect(qb.take).toHaveBeenCalledWith(3);
  });

  it('lança BadRequestException quando ultrapassa o limite', async () => {
    qb.getMany.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

    await expect(
      service.findForExport({ role: 'ADMIN' }, {}, 2),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ServiceOrdersService.summarize', () => {
  let service: ServiceOrdersService;
  let qb: {
    andWhere: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    setParameter: jest.Mock;
    getRawOne: jest.Mock;
  };

  beforeEach(() => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        remoteTotal: '4',
        remoteDone: '1',
        postTotal: '2',
        postDone: '2',
      }),
    };
    service = new ServiceOrdersService(
      { createQueryBuilder: jest.fn().mockReturnValue(qb) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('conta OS do mês vigente e do mês anterior e ignora o filtro de data', async () => {
    const summary = await service.summarize(
      { role: 'ADMIN' },
      {
        contractId: 'contract-1',
        from: '2020-01-01',
        to: '2020-01-31',
      } as any,
    );

    const sql = [
      ...qb.select.mock.calls,
      ...qb.addSelect.mock.calls,
    ]
      .map((call) => String(call[0]))
      .join('\n');
    expect(sql).toContain('COUNT(*) FILTER');
    expect(sql).toContain('EXISTS');
    expect(sql).toContain('fim_execucao" IS NOT NULL');
    expect(sql).toContain('summaryRemoteModule');
    expect(sql).toContain('summaryPostModule');
    expect(sql).toContain('postWorkEligibleResults');
    expect(sql).not.toContain('JOIN inspections');

    const periods = Object.fromEntries(qb.setParameter.mock.calls);
    const current = saoPauloYearMonth(new Date());
    const remote = monthDateRange(current.year, current.month);
    const previous = previousYearMonth(current.year, current.month);
    const post = monthDateRange(previous.year, previous.month);
    expect(periods.summaryRemoteFrom).toBe(remote.from);
    expect(periods.summaryRemoteTo).toBe(remote.to);
    expect(periods.summaryPostFrom).toBe(post.from);
    expect(periods.summaryPostTo).toBe(post.to);
    expect(periods.summaryRemoteFrom).not.toBe(periods.summaryPostFrom);

    const where = qb.andWhere.mock.calls.map((call) => String(call[0])).join('\n');
    expect(where).toContain('serviceOrder.contractId = :contractId');
    expect(where).not.toContain('serviceOrder.fimExecucao BETWEEN');
    expect(summary).toEqual({
      remote: { total: 4, done: 1 },
      postWork: { total: 2, done: 2 },
    });
  });
});
