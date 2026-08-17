import { UsersService } from './users.service';
import { UserRole } from '../common/enums';

function createQueryBuilderMock() {
  return {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
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

  it('lista fiscais do contrato informado', async () => {
    qb.getMany.mockResolvedValue([{ id: 'fiscal-1', name: 'Ana Fiscal' }]);

    const result = await service.findFiscals(
      { role: UserRole.ADMIN },
      'contract-1',
    );

    expect(qb.where).toHaveBeenCalledWith('u.role = :role', {
      role: UserRole.FISCAL,
    });
    expect(qb.innerJoin).toHaveBeenCalledWith(
      'u.contracts',
      'filterContract',
      'filterContract.id = :filterContractId',
      { filterContractId: 'contract-1' },
    );
    expect(result).toEqual({
      data: [{ id: 'fiscal-1', name: 'Ana Fiscal' }],
    });
  });

  it('restringe fiscais aos contratos do gestor', async () => {
    await service.findFiscals({
      role: UserRole.GESTOR,
      contracts: [{ id: 'contract-2' }],
    });

    expect(qb.innerJoin).toHaveBeenCalledWith(
      'u.contracts',
      'allowedContract',
      'allowedContract.id IN (:...allowedContractIds)',
      { allowedContractIds: ['contract-2'] },
    );
  });

  it('retorna lista vazia quando o contrato pedido está fora do escopo do gestor', async () => {
    const result = await service.findFiscals(
      {
        role: UserRole.GESTOR,
        contracts: [{ id: 'contract-2' }],
      },
      'contract-1',
    );

    expect(usersRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [] });
  });
});
