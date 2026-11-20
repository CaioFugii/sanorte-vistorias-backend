import { InvestmentWorkStatus } from '../common/enums';
import { InvestmentWorkSummaryService } from './investment-work-summary.service';

describe('InvestmentWorkSummaryService', () => {
  const now = new Date('2026-11-18T15:00:00.000Z');
  let service: InvestmentWorkSummaryService;
  let builders: ReturnType<typeof queryBuilder>[];

  beforeEach(() => {
    builders = [];
    const repository = {
      createQueryBuilder: jest.fn(() => {
        const qb = queryBuilder();
        builders.push(qb);
        return qb;
      }),
    };
    service = new InvestmentWorkSummaryService(repository as any);
  });

  it('em novembro a caixa Campo usa novembro inteiro e Pós Obra usa outubro', async () => {
    const result = await service.summarize(
      { role: 'ADMIN' },
      { from: '2026-11-01', to: '2026-11-30' },
      now,
    );

    expect(result.field.period).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(result.postWork.period).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(builders[0].andWhere).toHaveBeenCalledWith(
      'investmentWork.expectedEndDate BETWEEN :periodFrom AND :periodTo',
      { periodFrom: '2026-11-01', periodTo: '2026-11-30' },
    );
    expect(builders[1].andWhere).toHaveBeenCalledWith(
      'investmentWork.expectedEndDate BETWEEN :periodFrom AND :periodTo',
      { periodFrom: '2026-10-01', periodTo: '2026-10-31' },
    );
    expect(String(builders[0].addSelect.mock.calls[0][0])).toContain('LEAST(4');
  });

  it('mês futuro cai no mês atual', async () => {
    const result = await service.summarize(
      { role: 'ADMIN' },
      { from: '2026-12-01', to: '2026-12-31' },
      now,
    );

    expect(result.field.period).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(result.postWork.period.from).toBe('2026-10-01');
  });

  it('envia contrato, endereço, bairro, equipe e Pós Obra e deixa inativa e cancelada de fora', async () => {
    await service.summarize(
      { role: 'ADMIN' },
      {
        from: '2026-11-01',
        to: '2026-11-30',
        contractId: 'contract-1',
        address: 'Rua',
        district: 'Centro',
        pdaTeam: 'Equipe',
        postWork: true,
      },
      now,
    );

    for (const qb of builders) {
      expect(qb.andWhere).toHaveBeenCalledWith('investmentWork.active = true');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'investmentWork.status <> :cancelled',
        { cancelled: InvestmentWorkStatus.CANCELADA },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'investmentWork.contractId = :contractId',
        { contractId: 'contract-1' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'investmentWork.address ILIKE :address',
        { address: '%Rua%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'investmentWork.district ILIKE :district',
        { district: '%Centro%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(investmentWork.pdaTeamName ILIKE :pdaTeam OR team.name ILIKE :pdaTeam)',
        { pdaTeam: '%Equipe%' },
      );
      const clauses = qb.andWhere.mock.calls.map((call: unknown[]) => call[0]);
      expect(clauses.some((clause: string) => clause.startsWith('EXISTS '))).toBe(
        true,
      );
    }
  });
});

function queryBuilder() {
  const subquery = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getQuery: jest.fn(() => '(SELECT COUNT(*) FROM inspections)'),
  };
  const qb = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    subQuery: jest.fn(() => subquery),
    getRawOne: jest.fn().mockResolvedValue({ goal: '12', done: '4' }),
  };
  return qb;
}
