import { InvestmentWorksService } from './investment-works.service';

describe('InvestmentWorksService', () => {
  let service: InvestmentWorksService;
  let investmentWorkRepository: any;
  let inspectionRepository: any;

  beforeEach(() => {
    investmentWorkRepository = {
      createQueryBuilder: jest.fn(),
    };
    inspectionRepository = {
      createQueryBuilder: jest.fn(),
    };

    service = new InvestmentWorksService(
      investmentWorkRepository,
      {} as any,
      {} as any,
      inspectionRepository,
      {} as any,
    );
  });

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

    investmentWorkRepository.createQueryBuilder.mockReturnValue(listQb);
    inspectionRepository.createQueryBuilder.mockReturnValue(avgQb);

    const result = await service.findAll({ role: 'ADMIN' }, 1, 10);

    expect(result.data).toEqual([
      { id: 'work-1', workName: 'Obra Norte', averageScorePercent: 98.15 },
      { id: 'work-2', workName: 'Obra Sul', averageScorePercent: null },
    ]);
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
});
