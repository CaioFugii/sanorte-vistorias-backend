import { ForemenService } from './foremen.service';

function createQueryBuilderMock() {
  return {
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
    const service = new ForemenService(foremenRepository as any, {} as any);

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
    );

    await expect(service.remove('foreman-1')).rejects.toThrow(
      'Não é possível excluir um encarregado vinculado a equipes',
    );
    expect(foremenRepository.delete).not.toHaveBeenCalled();
  });
});
