import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Checklist, ChecklistItem, ChecklistSection, Inspection } from '../entities';
import { ModuleType } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
    @InjectRepository(ChecklistItem)
    private checklistItemsRepository: Repository<ChecklistItem>,
    @InjectRepository(ChecklistSection)
    private checklistSectionsRepository: Repository<ChecklistSection>,
    @InjectRepository(Inspection)
    private inspectionsRepository: Repository<Inspection>,
  ) {}

  async findAll(
    module?: ModuleType,
    active?: boolean,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Checklist>> {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (module) {
      where.module = module;
    }
    if (typeof active === 'boolean') {
      where.active = active;
    }

    const [data, total] = await this.checklistsRepository.findAndCount({
      where,
      relations: ['items', 'items.section', 'sections'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<Checklist> {
    return this.checklistsRepository.findOne({
      where: { id },
      relations: ['items', 'items.section', 'sections'],
    });
  }

  async create(checklistData: {
    module: ModuleType;
    name: string;
    description?: string;
    active?: boolean;
  }): Promise<Checklist> {
    const checklist = this.checklistsRepository.create(checklistData);
    const savedChecklist = await this.checklistsRepository.save(checklist);
    await this.ensureDefaultSection(savedChecklist.id);
    return this.findOne(savedChecklist.id);
  }

  async update(id: string, checklistData: Partial<Checklist>): Promise<Checklist> {
    await this.checklistsRepository.update(id, checklistData);
    return this.findOne(id);
  }

  async addItem(
    checklistId: string,
    itemData: {
      title: string;
      description?: string;
      order: number;
      sectionId?: string;
      requiresPhotoOnNonConformity?: boolean;
      active?: boolean;
    },
  ): Promise<ChecklistItem> {
    const defaultSection = await this.ensureDefaultSection(checklistId);

    const item = this.checklistItemsRepository.create({
      ...itemData,
      checklistId,
      sectionId: itemData.sectionId || defaultSection.id,
    });
    return this.checklistItemsRepository.save(item);
  }

  async updateItem(
    checklistId: string,
    itemId: string,
    itemData: Partial<ChecklistItem>,
  ): Promise<ChecklistItem> {
    await this.checklistItemsRepository.update(
      { id: itemId, checklistId },
      itemData,
    );
    return this.checklistItemsRepository.findOne({
      where: { id: itemId, checklistId },
    });
  }

  async addSection(
    checklistId: string,
    sectionData: { name: string; order: number; active?: boolean },
  ): Promise<ChecklistSection> {
    const section = this.checklistSectionsRepository.create({
      checklistId,
      name: sectionData.name,
      order: sectionData.order,
      active: sectionData.active ?? true,
    });
    return this.checklistSectionsRepository.save(section);
  }

  async updateSection(
    checklistId: string,
    sectionId: string,
    sectionData: Partial<ChecklistSection>,
  ): Promise<ChecklistSection> {
    await this.checklistSectionsRepository.update(
      { id: sectionId, checklistId },
      sectionData,
    );
    return this.checklistSectionsRepository.findOne({
      where: { id: sectionId, checklistId },
    });
  }

  async removeItem(checklistId: string, itemId: string): Promise<void> {
    await this.checklistItemsRepository.delete({ id: itemId, checklistId });
  }

  async removeChecklist(id: string): Promise<void> {
    const checklist = await this.checklistsRepository.findOne({ where: { id } });
    if (!checklist) {
      throw new NotFoundException('Checklist não encontrado');
    }

    const linkedInspections = await this.inspectionsRepository.count({
      where: { checklistId: id },
    });
    if (linkedInspections > 0) {
      throw new BadRequestException(
        'Não é possível deletar checklist com vistorias vinculadas',
      );
    }

    await this.checklistsRepository.delete(id);
  }

  private async ensureDefaultSection(checklistId: string): Promise<ChecklistSection> {
    let section = await this.checklistSectionsRepository.findOne({
      where: { checklistId, order: 1 },
    });

    if (!section) {
      section = this.checklistSectionsRepository.create({
        checklistId,
        name: 'Seção padrão',
        order: 1,
        active: true,
      });
      section = await this.checklistSectionsRepository.save(section);
    }

    return section;
  }
}
