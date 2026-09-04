import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService.remove', () => {
  let service: ServiceOrdersService;
  let serviceOrderRepository: {
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let inspectionRepository: {
    count: jest.Mock;
  };

  beforeEach(() => {
    serviceOrderRepository = {
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    inspectionRepository = {
      count: jest.fn(),
    };

    service = new ServiceOrdersService(
      serviceOrderRepository as any,
      {} as any,
      {} as any,
      inspectionRepository as any,
      {} as any,
    );
  });

  it('remove ordem de serviço sem vistorias vinculadas', async () => {
    serviceOrderRepository.findOne.mockResolvedValue({
      id: 'so-1',
      osNumber: '123',
    });
    inspectionRepository.count.mockResolvedValue(0);

    await service.remove('so-1');

    expect(serviceOrderRepository.delete).toHaveBeenCalledWith('so-1');
  });

  it('lança NotFoundException quando ordem de serviço não existe', async () => {
    serviceOrderRepository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(serviceOrderRepository.delete).not.toHaveBeenCalled();
  });

  it('lança BadRequestException quando há vistorias vinculadas', async () => {
    serviceOrderRepository.findOne.mockResolvedValue({
      id: 'so-1',
      osNumber: '123',
    });
    inspectionRepository.count.mockResolvedValue(2);

    await expect(service.remove('so-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(serviceOrderRepository.delete).not.toHaveBeenCalled();
  });
});

describe('ServiceOrdersService.findAll', () => {
  let service: ServiceOrdersService;
  let qb: {
    leftJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    orderBy: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let serviceOrderRepository: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
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
    );
  });

  it('aplica os mesmos filtros da listagem e limita a quantidade', async () => {
    const rows = await service.findForExport(
      { role: 'ADMIN' },
      { equipe: 'PDA 01', from: '2026-08-01', to: '2026-08-31' },
      2,
    );

    expect(rows).toEqual([{ osNumber: 'OS-1' }]);
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
