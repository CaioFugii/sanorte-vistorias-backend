import { UserRole } from '../common/enums';
import { TeamsService } from './teams.service';

function createQueryBuilderMock() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('TeamsService', () => {
  let service: TeamsService;
  let qb: ReturnType<typeof createQueryBuilderMock>;
  let teamsRepository: { createQueryBuilder: jest.Mock };

  beforeEach(() => {
    qb = createQueryBuilderMock();
    teamsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    service = new TeamsService(
      teamsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('filtra equipes ativas do contrato informado', async () => {
    await service.findAll(
      { role: UserRole.ADMIN },
      1,
      10,
      undefined,
      'contract-1',
    );

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM team_contracts tc'),
      { filterContractId: 'contract-1' },
    );
    expect(qb.leftJoin).toHaveBeenCalledWith('team.contracts', 'contracts');
    expect(qb.loadRelationCountAndMap).toHaveBeenCalledWith(
      'team.collaboratorCount',
      'team.collaborators',
    );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'team.sectors',
      'sectors',
    );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'team.foreman',
      'foreman',
    );
  });

  it('rejeita vínculo com encarregado inexistente', async () => {
    const nameQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    teamsRepository.createQueryBuilder.mockReturnValue(nameQuery);
    const foremenRepository = { exist: jest.fn().mockResolvedValue(false) };
    const localService = new TeamsService(
      teamsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      foremenRepository as any,
    );

    await expect(
      localService.create({
        name: 'Equipe Norte',
        contractIds: [],
        foremanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow('foremanId informado não existe');
    expect(foremenRepository.exist).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111' },
    });
  });

  it('filtra equipes ativas do setor informado', async () => {
    await service.findAll(
      { role: UserRole.ADMIN },
      1,
      10,
      undefined,
      undefined,
      'sector-1',
    );

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM team_sectors ts'),
      { filterSectorId: 'sector-1' },
    );
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'team.sectors',
      'sectors',
    );
  });

  it('retorna vazio quando o contrato está fora do escopo do gestor', async () => {
    await service.findAll(
      { role: UserRole.GESTOR, contracts: [{ id: 'contrato-permitido' }] },
      1,
      10,
      undefined,
      'contrato-nao-permitido',
    );

    expect(qb.andWhere).toHaveBeenCalledWith('1 = 0');
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM team_contracts tc'),
      expect.anything(),
    );
  });
});
