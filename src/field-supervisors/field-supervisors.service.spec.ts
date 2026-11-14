import { ConflictException } from '@nestjs/common';
import { FieldSupervisorsService } from './field-supervisors.service';

describe('FieldSupervisorsService', () => {
  it('cria supervisor de campo com contratos', async () => {
    const coordinator = { id: 'coord-1', name: 'Ana' };
    const contracts = [{ id: 'c1', name: 'Contrato A' }];
    const saved = {
      id: 'sup-1',
      name: 'Carlos',
      active: true,
      coordinatorId: 'coord-1',
      coordinator,
      contracts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fieldSupervisorsRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(saved),
      findOne: jest.fn().mockResolvedValue(saved),
    };
    const coordinatorsRepository = {
      exist: jest.fn().mockResolvedValue(true),
    };
    const contractsRepository = {
      findBy: jest.fn().mockResolvedValue(contracts),
    };
    const service = new FieldSupervisorsService(
      fieldSupervisorsRepository as any,
      coordinatorsRepository as any,
      contractsRepository as any,
      {} as any,
    );

    const result = await service.create({
      name: '  Carlos  ',
      coordinatorId: 'coord-1',
      contractIds: ['c1'],
    });

    expect(coordinatorsRepository.exist).toHaveBeenCalledWith({
      where: { id: 'coord-1' },
    });
    expect(contractsRepository.findBy).toHaveBeenCalled();
    expect(fieldSupervisorsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Carlos',
        coordinatorId: 'coord-1',
        contracts,
      }),
    );
    expect(result.coordinator).toEqual({ id: 'coord-1', name: 'Ana' });
    expect(result.contracts).toEqual([{ id: 'c1', name: 'Contrato A' }]);
  });

  it('recusa supervisor sem coordinatorId', async () => {
    const fieldSupervisorsRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new FieldSupervisorsService(
      fieldSupervisorsRepository as any,
      { exist: jest.fn() } as any,
      { findBy: jest.fn() } as any,
      {} as any,
    );

    await expect(
      service.create({ name: 'Carlos', contractIds: [] } as any),
    ).rejects.toThrow('coordinatorId é obrigatório');
    expect(fieldSupervisorsRepository.save).not.toHaveBeenCalled();
  });

  it('recusa exclusão de supervisor que tenha encarregado', async () => {
    const fieldSupervisorsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'sup-1', name: 'Carlos' }),
      delete: jest.fn(),
    };
    const foremenRepository = {
      count: jest.fn().mockResolvedValue(2),
    };
    const service = new FieldSupervisorsService(
      fieldSupervisorsRepository as any,
      {} as any,
      {} as any,
      foremenRepository as any,
    );

    const error = await service.remove('sup-1').then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    expect((error as ConflictException).message).toBe(
      'Não é possível excluir um supervisor de campo vinculado a encarregados',
    );
    expect(fieldSupervisorsRepository.delete).not.toHaveBeenCalled();
  });
});
