import { ConflictException } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('CoordinatorsService', () => {
  it('ignora busca textual com menos de 3 caracteres', async () => {
    const qb = createQueryBuilderMock();
    const coordinatorsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn(),
    };
    const service = new CoordinatorsService(
      coordinatorsRepository as any,
      {} as any,
      {} as any,
    );

    await service.findAll('ab', undefined, 1, 10);

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(coordinatorsRepository.find).not.toHaveBeenCalled();
  });

  it('cria coordenador com contratos', async () => {
    const contracts = [{ id: 'c1', name: 'Contrato A' }];
    const createdAt = new Date();
    const updatedAt = new Date();
    const saved = {
      id: 'coord-1',
      name: 'Ana',
      active: true,
      createdAt,
      updatedAt,
      contracts,
    };
    const coordinatorsRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(saved),
      findOne: jest.fn().mockResolvedValue(saved),
    };
    const contractsRepository = {
      findBy: jest.fn().mockResolvedValue(contracts),
    };
    const service = new CoordinatorsService(
      coordinatorsRepository as any,
      contractsRepository as any,
      {} as any,
    );

    const result = await service.create({ name: '  Ana  ', contractIds: ['c1'] });

    expect(contractsRepository.findBy).toHaveBeenCalled();
    expect(coordinatorsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana', active: true, contracts }),
    );
    expect(result.contracts).toEqual([{ id: 'c1', name: 'Contrato A' }]);
  });

  it('aceita coordenador com contractIds vazio', async () => {
    const saved = {
      id: 'coord-1',
      name: 'Ana',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      contracts: [],
    };
    const coordinatorsRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(saved),
      findOne: jest.fn().mockResolvedValue(saved),
    };
    const contractsRepository = { findBy: jest.fn() };
    const service = new CoordinatorsService(
      coordinatorsRepository as any,
      contractsRepository as any,
      {} as any,
    );

    const result = await service.create({ name: 'Ana', contractIds: [] });

    expect(contractsRepository.findBy).not.toHaveBeenCalled();
    expect(result.contracts).toEqual([]);
  });

  it('recusa exclusão de coordenador que tenha supervisor', async () => {
    const coordinatorsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'coord-1', name: 'Ana' }),
      delete: jest.fn(),
    };
    const fieldSupervisorsRepository = {
      count: jest.fn().mockResolvedValue(1),
    };
    const service = new CoordinatorsService(
      coordinatorsRepository as any,
      {} as any,
      fieldSupervisorsRepository as any,
    );

    const error = await service.remove('coord-1').then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as ConflictException).message).toBe(
      'Não é possível excluir um coordenador vinculado a supervisores de campo',
    );
    expect(coordinatorsRepository.delete).not.toHaveBeenCalled();
  });
});
