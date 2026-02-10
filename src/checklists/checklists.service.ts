import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Checklist, ChecklistItem } from '../entities';
import { ModuleType } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class ChecklistsService {
  constructor(
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
    @InjectRepository(ChecklistItem)
    private checklistItemsRepository: Repository<ChecklistItem>,
  ) {}

  async findAll(
    module?: ModuleType,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Checklist>> {
    const skip = (page - 1) * limit;
    const where: any = { active: true };
    if (module) {
      where.module = module;
    }

    const [data, total] = await this.checklistsRepository.findAndCount({
      where,
      relations: ['items'],
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
      relations: ['items'],
    });
  }

  async create(checklistData: {
    module: ModuleType;
    name: string;
    description?: string;
    active?: boolean;
  }): Promise<Checklist> {
    const checklist = this.checklistsRepository.create(checklistData);
    return this.checklistsRepository.save(checklist);
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
      requiresPhotoOnNonConformity?: boolean;
      active?: boolean;
    },
  ): Promise<ChecklistItem> {
    const item = this.checklistItemsRepository.create({
      ...itemData,
      checklistId,
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

  async removeItem(checklistId: string, itemId: string): Promise<void> {
    await this.checklistItemsRepository.delete({ id: itemId, checklistId });
  }
}
