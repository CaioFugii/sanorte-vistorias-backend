import { ForemenService } from './foremen.service';

function createQueryBuilderMock() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
  };
}

describe('ForemenService', () => {
  it('ignora busca textual com menos de 3 caracteres', async () => {
    const qb = createQueryBuilderMock();
    const foremenRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const teamsRepository = { find: jest.fn() };
    const service = new ForemenService(
      foremenRepository as any,
      teamsRepository as any,
      {} as any,
    );

    await service.findAll('ab', undefined, 1, 10);

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(teamsRepository.find).not.toHaveBeenCalled();
  });

  it('impede nome duplicado ignorando maiúsculas', async () => {
    const qb = createQueryBuilderMock();
    qb.getOne.mockResolvedValue({ id: 'existing', name: 'João' });
    const foremenRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new ForemenService(foremenRepository as any, {} as any, {} as any);

    await expect(service.create({ name: '  joão  ' })).rejects.toThrow(
      'Já existe um encarregado com este nome',
    );
    expect(foremenRepository.save).not.toHaveBeenCalled();
  });

  it('impede exclusão quando há equipes vinculadas', async () => {
    const foremenRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'foreman-1', name: 'João' }),
      delete: jest.fn(),
    };
    const teamsRepository = {
      count: jest.fn().mockResolvedValue(2),
    };
    const service = new ForemenService(
      foremenRepository as any,
      teamsRepository as any,
      {} as any,
    );

    await expect(service.remove('foreman-1')).rejects.toThrow(
      'Não é possível excluir um encarregado vinculado a equipes',
    );
    expect(foremenRepository.delete).not.toHaveBeenCalled();
  });

  it('atualiza encarregado com fieldSupervisorId nulo', async () => {
    const existing = {
      id: 'foreman-1',
      name: 'João',
      active: true,
      fieldSupervisorId: 'sup-1',
    };
    const updated = {
      ...existing,
      fieldSupervisorId: null,
      fieldSupervisor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const foremenRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const teamsRepository = { find: jest.fn().mockResolvedValue([]) };
    const fieldSupervisorsRepository = { exist: jest.fn() };
    const service = new ForemenService(
      foremenRepository as any,
      teamsRepository as any,
      fieldSupervisorsRepository as any,
    );

    const result = await service.update('foreman-1', { fieldSupervisorId: null });

    expect(fieldSupervisorsRepository.exist).not.toHaveBeenCalled();
    expect(foremenRepository.update).toHaveBeenCalledWith('foreman-1', {
      fieldSupervisorId: null,
    });
    expect(result.fieldSupervisorId).toBeNull();
    expect(result.fieldSupervisor).toBeNull();
  });

  it('atualiza encarregado com fieldSupervisorId válido', async () => {
    const existing = {
      id: 'foreman-1',
      name: 'João',
      active: true,
      fieldSupervisorId: null,
    };
    const supervisor = { id: 'sup-1', name: 'Maria' };
    const updated = {
      ...existing,
      fieldSupervisorId: 'sup-1',
      fieldSupervisor: supervisor,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const foremenRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const teamsRepository = { find: jest.fn().mockResolvedValue([]) };
    const fieldSupervisorsRepository = {
      exist: jest.fn().mockResolvedValue(true),
    };
    const service = new ForemenService(
      foremenRepository as any,
      teamsRepository as any,
      fieldSupervisorsRepository as any,
    );

    const result = await service.update('foreman-1', { fieldSupervisorId: 'sup-1' });

    expect(fieldSupervisorsRepository.exist).toHaveBeenCalledWith({
      where: { id: 'sup-1' },
    });
    expect(foremenRepository.update).toHaveBeenCalledWith('foreman-1', {
      fieldSupervisorId: 'sup-1',
    });
    expect(result.fieldSupervisor).toEqual({ id: 'sup-1', name: 'Maria' });
  });
});
