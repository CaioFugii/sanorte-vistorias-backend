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
    serviceOrderRepository.findOne.mockResolvedValue({ id: 'so-1', osNumber: '123' });
    inspectionRepository.count.mockResolvedValue(0);

    await service.remove('so-1');

    expect(serviceOrderRepository.delete).toHaveBeenCalledWith('so-1');
  });

  it('lança NotFoundException quando ordem de serviço não existe', async () => {
    serviceOrderRepository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(serviceOrderRepository.delete).not.toHaveBeenCalled();
  });

  it('lança BadRequestException quando há vistorias vinculadas', async () => {
    serviceOrderRepository.findOne.mockResolvedValue({ id: 'so-1', osNumber: '123' });
    inspectionRepository.count.mockResolvedValue(2);

    await expect(service.remove('so-1')).rejects.toBeInstanceOf(BadRequestException);
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
