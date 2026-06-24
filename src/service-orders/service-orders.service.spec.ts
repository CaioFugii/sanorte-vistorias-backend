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
