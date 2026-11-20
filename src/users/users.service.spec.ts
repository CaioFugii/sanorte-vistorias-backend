import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { AccessArea, UserRole } from '../common/enums';

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
    service = new UsersService(usersRepository as any, {} as any, {} as any);
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

  it('devolve as três áreas do Fiscal de partida', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'fiscal-1',
      name: 'Ana',
      email: 'fiscal@sanorte.com',
      role: UserRole.FISCAL,
      accessProfileId: 'perfil-fiscal',
      accessProfile: {
        areas: [
          { area: AccessArea.CAMPO_MINHAS },
          { area: AccessArea.CAMPO_NOVA },
          { area: AccessArea.ENGENHARIA_RELATORIOS },
        ],
      },
    });
    const contractsQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const authService = new UsersService(
      { findOne } as any,
      { createQueryBuilder: jest.fn().mockReturnValue(contractsQuery) } as any,
      {} as any,
    );

    const result = await authService.findOneForAuth('fiscal-1');

    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'fiscal-1' },
      relations: ['accessProfile', 'accessProfile.areas'],
    });
    expect(result?.areas).toEqual([
      AccessArea.CAMPO_MINHAS,
      AccessArea.CAMPO_NOVA,
      AccessArea.ENGENHARIA_RELATORIOS,
    ]);
  });

  it('não salva quem não é Administrador sem Acesso', async () => {
    const accessProfilesRepository = { findOne: jest.fn() };
    const usersRepository = { create: jest.fn(), save: jest.fn() };
    const ruled = new UsersService(
      usersRepository as any,
      {} as any,
      accessProfilesRepository as any,
    );

    await expect(
      ruled.create(
        {
          name: 'Ana',
          email: 'ana@sanorte.com',
          password: 'senha123',
          role: UserRole.FISCAL,
          contractIds: [],
        },
        { role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('salva Administrador sem Acesso e não grava um', async () => {
    const usersRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
    };
    const ruled = new UsersService(
      usersRepository as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
    );

    const saved = await ruled.create(
      {
        name: 'Admin',
        email: 'admin2@sanorte.com',
        password: 'senha123',
        role: UserRole.ADMIN,
        contractIds: [],
      },
      { role: UserRole.ADMIN },
    );

    expect(saved.accessProfileId).toBeNull();
  });

  it('não deixa quem não é Administrador gravar Acesso nem promover', async () => {
    const findOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      role: UserRole.FISCAL,
      accessProfileId: 'perfil-fiscal',
      contracts: [],
    });
    const usersRepository = {
      findOne,
      merge: jest.fn((current, ...rest) => Object.assign(current, ...rest)),
      save: jest.fn(),
    };
    const ruled = new UsersService(
      usersRepository as any,
      {} as any,
      {} as any,
    );
    const base = {
      name: 'Ana',
      contractIds: [],
    };

    await expect(
      ruled.update(
        'user-1',
        { ...base, accessProfileId: 'outro' },
        { role: UserRole.GESTOR },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      ruled.update(
        'user-1',
        { ...base, role: UserRole.ADMIN },
        { role: UserRole.GESTOR },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('grava o Acesso novo mesmo com o Acesso antigo carregado', async () => {
    const saved: any[] = [];
    const usersRepository = {
      findOne: jest.fn(async () => ({
        id: 'user-1',
        role: UserRole.FISCAL,
        accessProfileId: 'perfil-antigo',
        accessProfile: { id: 'perfil-antigo', areas: [] },
        contracts: [],
      })),
      merge: jest.fn((current, ...rest) => Object.assign(current, ...rest)),
      save: jest.fn(async (user) => saved.push({ ...user })),
    };
    const accessProfilesRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'perfil-novo' }),
    };
    const ruled = new UsersService(
      usersRepository as any,
      {} as any,
      accessProfilesRepository as any,
    );

    await ruled.update(
      'user-1',
      { accessProfileId: 'perfil-novo', contractIds: [] },
      { role: UserRole.ADMIN },
    );
    await ruled.update(
      'user-1',
      { role: UserRole.ADMIN, accessProfileId: null, contractIds: [] },
      { role: UserRole.ADMIN },
    );

    const [first, second] = saved;
    expect(first.accessProfileId).toBe('perfil-novo');
    expect(first.accessProfile).toEqual({ id: 'perfil-novo' });
    expect(second.accessProfileId).toBeNull();
    expect(second.accessProfile).toBeNull();
  });

  it('não devolve o hash da senha na listagem', async () => {
    qb.getManyAndCount.mockResolvedValue([[{ id: 'user-1' }], 1]);
    usersRepository.find.mockResolvedValue([
      { id: 'user-1', name: 'Ana', passwordHash: 'hash', contracts: [] },
    ]);

    const result = await service.findAll(1, 10);

    expect(result.data).toEqual([{ id: 'user-1', name: 'Ana', contracts: [] }]);
  });

  it('não deixa quem não é Administrador alterar ou excluir um Administrador', async () => {
    const admin = {
      id: 'admin-1',
      role: UserRole.ADMIN,
      accessProfileId: null,
      contracts: [],
    };
    const usersRepository = {
      findOne: jest.fn().mockResolvedValue(admin),
      merge: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const ruled = new UsersService(
      usersRepository as any,
      {} as any,
      {} as any,
    );
    const gestor = { role: UserRole.GESTOR };

    await expect(
      ruled.update(
        'admin-1',
        { name: 'Admin', password: 'nova', contractIds: [] } as any,
        gestor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      ruled.update(
        'admin-1',
        { role: UserRole.GESTOR, contractIds: [] },
        gestor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      ruled.updateContracts('admin-1', [], gestor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ruled.remove('admin-1', gestor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(usersRepository.delete).not.toHaveBeenCalled();
  });

  it('deixa quem não é Administrador excluir um usuário comum', async () => {
    const usersRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'fiscal-1', role: UserRole.FISCAL }),
      delete: jest.fn(),
    };
    const ruled = new UsersService(
      usersRepository as any,
      {} as any,
      {} as any,
    );

    await ruled.remove('fiscal-1', { role: UserRole.GESTOR });

    expect(usersRepository.delete).toHaveBeenCalledWith('fiscal-1');
  });
});
