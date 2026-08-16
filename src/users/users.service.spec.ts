import { UsersService } from './users.service';

function createQueryBuilderMock() {
  return {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let qb: ReturnType<typeof createQueryBuilderMock>;
  let usersRepository: { createQueryBuilder: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    qb = createQueryBuilderMock();
    usersRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([]),
    };
    service = new UsersService(usersRepository as any, {} as any);
  });

  it('filtra usuários pelo contrato informado', async () => {
    await service.findAll(1, 10, 'contract-1');

    expect(qb.innerJoin).toHaveBeenCalledWith(
      'u.contracts',
      'filterContract',
      'filterContract.id = :filterContractId',
      { filterContractId: 'contract-1' },
    );
  });

  it('não aplica filtro de contrato quando o parâmetro está vazio', async () => {
    await service.findAll(1, 10, '   ');

    expect(qb.innerJoin).not.toHaveBeenCalled();
  });
});
