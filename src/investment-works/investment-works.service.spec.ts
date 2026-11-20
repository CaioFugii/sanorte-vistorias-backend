import { BadRequestException } from '@nestjs/common';
import {
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  InvestmentWorkOrigin,
  ModuleType,
} from '../common/enums';
import { InvestmentWork, InvestmentWorkDescription } from '../entities';
import { InvestmentWorksService } from './investment-works.service';

function listQuery() {
  const subquery = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getQuery: jest.fn(
      () =>
        '(SELECT 1 FROM inspections "realizedPostWork" WHERE realizedPostWork.investmentWorkId = investmentWork.id)',
    ),
  };
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    subQuery: jest.fn(() => subquery),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('InvestmentWorksService', () => {
  let service: InvestmentWorksService;
  let investmentWorkRepository: any;
  let contractRepository: any;
  let teamRepository: any;
  let inspectionRepository: any;
  let descriptionRepository: any;
  let transactionManager: any;

  beforeEach(() => {
    transactionManager = {
      update: jest.fn(),
      delete: jest.fn(),
    };
    investmentWorkRepository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'work-new', ...value })),
      update: jest.fn(),
      manager: {
        transaction: jest.fn(async (work: (manager: any) => Promise<void>) =>
          work(transactionManager),
        ),
      },
    };
    contractRepository = {
      findOne: jest.fn(async () => ({ id: 'contract-1' })),
    };
    teamRepository = {
      findOne: jest.fn(async () => ({
        id: 'team-1',
        active: true,
        contracts: [{ id: 'contract-1' }],
      })),
    };
    inspectionRepository = {
      createQueryBuilder: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };
    descriptionRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    service = new InvestmentWorksService(
      investmentWorkRepository,
      contractRepository,
      teamRepository,
      inspectionRepository,
      {} as any,
      descriptionRepository,
    );
  });

  function mockScopedWork(work: Record<string, unknown>) {
    investmentWorkRepository.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(work),
    });
  }

  it('deve anexar a média das vistorias na listagem', async () => {
    const listQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          { id: 'work-1', workName: 'Obra Norte' },
          { id: 'work-2', workName: 'Obra Sul' },
        ],
        2,
      ]),
    };
    const avgQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { investmentWorkId: 'work-1', avgScore: '98.15' },
      ]),
    };
    const countQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          investmentWorkId: 'work-1',
          evaluationModule: InvestmentWorkEvaluationModule.CAMPO,
          total: '2',
        },
        {
          investmentWorkId: 'work-1',
          evaluationModule: InvestmentWorkEvaluationModule.POS_OBRA,
          total: '1',
        },
      ]),
    };

    investmentWorkRepository.createQueryBuilder.mockReturnValue(listQb);
    inspectionRepository.createQueryBuilder
      .mockReturnValueOnce(avgQb)
      .mockReturnValueOnce(countQb);

    const result = await service.findAll({ role: 'ADMIN' }, 1, 10);

    expect(result.data).toEqual([
      {
        id: 'work-1',
        workName: 'Obra Norte',
        averageScorePercent: 98.15,
        fieldInspectionCount: 2,
        postWorkInspectionCount: 1,
      },
      {
        id: 'work-2',
        workName: 'Obra Sul',
        averageScorePercent: null,
        fieldInspectionCount: 0,
        postWorkInspectionCount: 0,
      },
    ]);
    expect(countQb.andWhere).toHaveBeenCalledWith('inspection.module = :module', {
      module: ModuleType.OBRAS_INVESTIMENTO,
    });
    expect(countQb.andWhere).toHaveBeenCalledWith(
      'inspection.status <> :draft',
      { draft: InspectionStatus.RASCUNHO },
    );
    expect(listQb.leftJoinAndSelect).toHaveBeenCalledWith(
      'investmentWork.sector',
      'sector',
    );
    expect(avgQb.where).toHaveBeenCalledWith(
      'inspection.investmentWorkId IN (:...investmentWorkIds)',
      { investmentWorkIds: ['work-1', 'work-2'] },
    );
  });

  it('não consulta médias quando a listagem está vazia', async () => {
    const listQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    investmentWorkRepository.createQueryBuilder.mockReturnValue(listQb);

    const result = await service.findAll({ role: 'ADMIN' }, 1, 10);

    expect(result.data).toEqual([]);
    expect(inspectionRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('ignora endereço, bairro e equipe PDA com menos de 3 caracteres', async () => {
    const listQb = listQuery();
    investmentWorkRepository.createQueryBuilder.mockReturnValue(listQb);

    await service.findAll({ role: 'ADMIN' }, 1, 10, {
      address: 'ab',
      district: '  x ',
      pdaTeam: 'eq',
    });

    expect(listQb.andWhere).not.toHaveBeenCalled();
    expect(listQb.orderBy).toHaveBeenCalledWith(
      'investmentWork.createdAt',
      'DESC',
    );
  });

  it('filtra mês, endereço e equipe PDA e ordena pela data de execução', async () => {
    const listQb = listQuery();
    investmentWorkRepository.createQueryBuilder.mockReturnValue(listQb);

    await service.findAll({ role: 'ADMIN' }, 1, 10, {
      from: '2026-11-01',
      to: '2026-11-30',
      address: 'Rua',
      district: 'Centro',
      pdaTeam: 'Equipe',
      origin: InvestmentWorkOrigin.IMPORT,
    });

    expect(listQb.andWhere).toHaveBeenCalledWith(
      'investmentWork.expectedEndDate >= :from',
      { from: '2026-11-01' },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'investmentWork.expectedEndDate <= :to',
      { to: '2026-11-30' },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      'investmentWork.address ILIKE :address',
      { address: '%Rua%' },
    );
    expect(listQb.andWhere).toHaveBeenCalledWith(
      '(investmentWork.pdaTeamName ILIKE :pdaTeam OR team.name ILIKE :pdaTeam)',
      { pdaTeam: '%Equipe%' },
    );
    expect(listQb.orderBy).toHaveBeenCalledWith(
      'investmentWork.expectedEndDate',
      'ASC',
    );
    expect(listQb.addOrderBy).toHaveBeenCalledWith(
      'investmentWork.workName',
      'ASC',
    );
  });

  it('filtra Pós Obra realizada nas duas origens', async () => {
    const listQb = listQuery();
    investmentWorkRepository.createQueryBuilder.mockReturnValue(listQb);

    await service.findAll({ role: 'ADMIN' }, 1, 10, { postWork: true });
    await service.findAll({ role: 'ADMIN' }, 1, 10, { postWork: false });

    const clauses = listQb.andWhere.mock.calls.map((call: unknown[]) => call[0]);
    expect(clauses.some((clause: string) => clause.startsWith('EXISTS '))).toBe(
      true,
    );
    expect(clauses.some((clause: string) => clause.startsWith('NOT EXISTS '))).toBe(
      true,
    );
    expect(listQb.subQuery().andWhere).toHaveBeenCalledWith(
      'realizedPostWork.evaluationModule = :posObraEvaluation',
    );
    expect(listQb.subQuery().andWhere).toHaveBeenCalledWith(
      'realizedPostWork.status <> :draftStatus',
    );
  });

  it('cria cadastro manual sem bacia e rede', async () => {
    const saved = {
      id: 'work-new',
      origin: InvestmentWorkOrigin.MANUAL,
      basin: null,
      materialNetwork: null,
    };
    investmentWorkRepository.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(saved),
    });

    await service.create(
      {
        workName: 'Obra nova',
        startDate: '2026-11-01',
        expectedEndDate: '2026-11-20',
        address: 'Rua A',
        district: 'Centro',
        service: 'Ligação',
        teamId: 'team-1',
        contractId: 'contract-1',
      } as any,
      { id: 'user-1', role: 'ADMIN' },
    );

    expect(investmentWorkRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: InvestmentWorkOrigin.MANUAL,
        basin: null,
        materialNetwork: null,
        singularities: null,
      }),
    );
  });

  it('editar sem bacia, rede e singularidades preserva os valores', async () => {
    const existing = {
      id: 'work-1',
      contractId: 'contract-1',
      teamId: 'team-1',
      startDate: '2026-11-01',
      expectedEndDate: '2026-11-20',
      basin: 'Bacia antiga',
      materialNetwork: 'PVC',
      singularities: 'Poço',
    };
    investmentWorkRepository.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existing),
    });

    await service.update('work-1', { workName: 'Obra editada' }, {
      id: 'user-1',
      role: 'ADMIN',
    });

    const payload = investmentWorkRepository.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('basin');
    expect(payload).not.toHaveProperty('materialNetwork');
    expect(payload).not.toHaveProperty('singularities');
    expect(payload.workName).toBe('Obra editada');
  });

  it('recusa previsão de término anterior à data de início', async () => {
    await expect(
      service.create(
        {
          workName: 'Obra',
          startDate: '2026-11-20',
          expectedEndDate: '2026-11-01',
          address: 'Rua A',
          district: 'Centro',
          service: 'Ligação',
          teamId: 'team-1',
          contractId: 'contract-1',
        } as any,
        { id: 'user-1', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('edita só os campos permitidos do cadastro por Excel', async () => {
    mockScopedWork({
      id: 'work-1',
      origin: InvestmentWorkOrigin.IMPORT,
      contractId: 'contract-1',
      startDate: '2026-10-20',
      expectedEndDate: '2026-10-20',
    });

    await expect(
      service.update('work-1', { workName: 'outro' }, admin),
    ).rejects.toThrow(
      'Campo não editável em cadastro por Excel: workName',
    );

    await service.update(
      'work-1',
      {
        address: 'Rua Nova',
        district: 'Centro',
        pdaTeamName: 'Equipe PDA',
        expectedEndDate: '2026-11-02',
        status: 'CANCELADA' as any,
        active: false,
      },
      admin,
    );

    expect(transactionManager.update).toHaveBeenCalledWith(
      InvestmentWork,
      'work-1',
      expect.objectContaining({
        address: 'Rua Nova',
        district: 'Centro',
        pdaTeamName: 'Equipe PDA',
        expectedEndDate: '2026-11-02',
        startDate: '2026-11-02',
        status: 'CANCELADA',
        active: false,
      }),
    );
    expect(transactionManager.update).toHaveBeenCalledWith(
      InvestmentWorkDescription,
      { investmentWorkId: 'work-1' },
      { executionDate: '2026-11-02' },
    );
  });

  it('recusa a nova data quando a Descrição já existe no contrato', async () => {
    mockScopedWork({
      id: 'work-1',
      origin: InvestmentWorkOrigin.IMPORT,
      contractId: 'contract-1',
      startDate: '2026-10-20',
      expectedEndDate: '2026-10-20',
    });
    transactionManager.update.mockImplementation(async (entity: unknown) => {
      if (entity === InvestmentWorkDescription) {
        const error = new Error('duplicate') as Error & {
          driverError: { code: string };
        };
        error.driverError = { code: '23505' };
        throw error;
      }
    });

    await expect(
      service.update('work-1', { expectedEndDate: '2026-11-02' }, admin),
    ).rejects.toThrow(
      'Já existe cadastro por Excel com esta O.S, data e Descrição neste contrato.',
    );
  });

  it('devolve as Descrições do cadastro por Excel em ordem alfabética', async () => {
    mockScopedWork({
      id: 'work-1',
      origin: InvestmentWorkOrigin.IMPORT,
      contractId: 'contract-1',
    });
    descriptionRepository.find.mockResolvedValue([
      { description: 'Asfalto' },
      { description: 'Binder' },
    ]);
    inspectionRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avgScore: null }),
    });
    const pendingRepository = (service as any).pendingAdjustmentRepository;
    pendingRepository.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });

    const detail = await service.findOne('work-1', admin);

    expect(descriptionRepository.find).toHaveBeenCalledWith({
      where: { investmentWorkId: 'work-1' },
      order: { description: 'ASC' },
    });
    expect(detail.descriptions).toEqual(['Asfalto', 'Binder']);
  });

  it('excluir cadastro por Excel sem vistoria desvincula as Descrições', async () => {
    mockScopedWork({
      id: 'work-1',
      origin: InvestmentWorkOrigin.IMPORT,
      contractId: 'contract-1',
    });

    await service.remove('work-1', admin);

    expect(transactionManager.update).toHaveBeenCalledWith(
      InvestmentWorkDescription,
      { investmentWorkId: 'work-1' },
      { investmentWorkId: null },
    );
    expect(transactionManager.delete).toHaveBeenCalledWith(InvestmentWork, 'work-1');
  });

  it('recusa excluir obra com vistoria vinculada', async () => {
    mockScopedWork({
      id: 'work-1',
      origin: InvestmentWorkOrigin.MANUAL,
      contractId: 'contract-1',
    });
    inspectionRepository.count.mockResolvedValue(1);

    await expect(service.remove('work-1', admin)).rejects.toThrow(
      'Não é possível remover obra com inspeções vinculadas',
    );
    expect(investmentWorkRepository.manager.transaction).not.toHaveBeenCalled();
  });
});

const admin = { id: 'user-1', role: 'ADMIN' };
