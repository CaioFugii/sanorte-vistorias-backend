import { BadRequestException } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { ModuleType } from '../common/enums';

function createQueryBuilderMock() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([
      [{ id: 'cl-1', name: 'Checklist A', sectionCount: 2, itemCount: 8 }],
      1,
    ]),
  };
}

describe('ChecklistsService', () => {
  let service: ChecklistsService;
  let qb: ReturnType<typeof createQueryBuilderMock>;
  let checklistsRepository: { createQueryBuilder: jest.Mock };

  beforeEach(() => {
    qb = createQueryBuilderMock();
    checklistsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    service = new ChecklistsService(
      checklistsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('lista checklists sem hidratar items/sections, só contagens', async () => {
    const result = await service.findAll(
      ModuleType.CAMPO,
      undefined,
      true,
      undefined,
      1,
      100,
    );

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'checklist.sector',
      'sector',
    );
    expect(qb.loadRelationCountAndMap).toHaveBeenCalledWith(
      'checklist.sectionCount',
      'checklist.sections',
    );
    expect(qb.loadRelationCountAndMap).toHaveBeenCalledWith(
      'checklist.itemCount',
      'checklist.items',
    );
    expect(qb.leftJoinAndSelect).not.toHaveBeenCalledWith(
      expect.stringContaining('items'),
      expect.anything(),
    );
    expect(result.data[0]).toMatchObject({
      id: 'cl-1',
      sectionCount: 2,
      itemCount: 8,
    });
    expect(result.meta).toMatchObject({ page: 1, limit: 100, total: 1 });
  });

  it('rejeita adicionar pergunta quando o checklist já está no limite de itens', async () => {
    const checklistItemsRepository = {
      count: jest.fn().mockResolvedValue(ChecklistsService.MAX_ITEMS),
      create: jest.fn(),
      save: jest.fn(),
    };
    const serviceWithRepos = new ChecklistsService(
      {} as any,
      checklistItemsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      serviceWithRepos.addItem('cl-1', {
        title: 'Pergunta extra',
        order: ChecklistsService.MAX_ITEMS + 1,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      serviceWithRepos.addItem('cl-1', {
        title: 'Pergunta extra',
        order: ChecklistsService.MAX_ITEMS + 1,
      }),
    ).rejects.toThrow(
      `O checklist não pode ter mais de ${ChecklistsService.MAX_ITEMS} perguntas.`,
    );
    expect(checklistItemsRepository.create).not.toHaveBeenCalled();
    expect(checklistItemsRepository.save).not.toHaveBeenCalled();
  });

  it('permite adicionar pergunta quando há folga até o limite de itens', async () => {
    const savedItem = { id: 'item-last', title: 'Última pergunta' };
    const checklistItemsRepository = {
      count: jest.fn().mockResolvedValue(ChecklistsService.MAX_ITEMS - 1),
      create: jest.fn().mockReturnValue(savedItem),
      save: jest.fn().mockResolvedValue(savedItem),
    };
    const checklistSectionsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'sec-1' }),
    };
    const serviceWithRepos = new ChecklistsService(
      {} as any,
      checklistItemsRepository as any,
      checklistSectionsRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      serviceWithRepos.addItem('cl-1', {
        title: 'Última pergunta',
        order: ChecklistsService.MAX_ITEMS,
        sectionId: 'sec-1',
      }),
    ).resolves.toMatchObject({ id: 'item-last' });
    expect(checklistItemsRepository.save).toHaveBeenCalled();
  });
});
