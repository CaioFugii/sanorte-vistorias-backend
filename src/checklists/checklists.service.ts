import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Checklist,
  ChecklistItem,
  ChecklistSection,
  Inspection,
  Sector,
} from '../entities';
import { InspectionScope, ModuleType } from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

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
    @InjectRepository(Sector)
    private sectorsRepository: Repository<Sector>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async findAll(
    module?: ModuleType,
    inspectionScope?: InspectionScope,
    active?: boolean,
    sectorId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Checklist>> {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (module) {
      where.module = module;
    }
    if (inspectionScope) {
      where.inspectionScope = inspectionScope;
    }
    if (typeof active === 'boolean') {
      where.active = active;
    }
    if (sectorId) {
      where.sectorId = sectorId;
    }

    const [data, total] = await this.checklistsRepository.findAndCount({
      where,
      relations: ['sector', 'items', 'items.section', 'sections'],
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
      relations: ['sector', 'items', 'items.section', 'sections'],
    });
  }

  async create(checklistData: {
    module: ModuleType;
    inspectionScope?: InspectionScope;
    name: string;
    description?: string;
    active?: boolean;
    sectorId?: string;
  }): Promise<Checklist> {
    await this.validateSector(checklistData.sectorId);
    const checklist = this.checklistsRepository.create(checklistData);
    const savedChecklist = await this.checklistsRepository.save(checklist);
    await this.ensureDefaultSection(savedChecklist.id);
    return this.findOne(savedChecklist.id);
  }

  async update(
    id: string,
    checklistData: Partial<Checklist>,
  ): Promise<Checklist> {
    if (Object.prototype.hasOwnProperty.call(checklistData, 'sectorId')) {
      await this.validateSector(checklistData.sectorId);
    }

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

  async uploadItemReferenceImage(
    checklistId: string,
    itemId: string,
    file: Express.Multer.File,
  ): Promise<ChecklistItem> {
    const item = await this.findChecklistItemOrFail(checklistId, itemId);

    const uploaded = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: 'quality/checklists/reference-images',
    });

    if (item.referenceImagePublicId) {
      await this.cloudinaryService.deleteAsset(item.referenceImagePublicId);
    }

    await this.checklistItemsRepository.update(item.id, {
      referenceImageUrl: uploaded.secure_url,
      referenceImagePublicId: uploaded.public_id,
    });

    return this.findChecklistItemOrFail(checklistId, itemId);
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
    const checklist = await this.checklistsRepository.findOne({
      where: { id },
    });
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

  private async ensureDefaultSection(
    checklistId: string,
  ): Promise<ChecklistSection> {
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

  private async validateSector(sectorId?: string): Promise<void> {
    if (!sectorId) {
      return;
    }

    const sectorExists = await this.sectorsRepository.exist({
      where: { id: sectorId },
    });
    if (!sectorExists) {
      throw new BadRequestException('sectorId informado não existe');
    }
  }

  private async findChecklistItemOrFail(
    checklistId: string,
    itemId: string,
  ): Promise<ChecklistItem> {
    const item = await this.checklistItemsRepository.findOne({
      where: { id: itemId, checklistId },
    });
    if (!item) {
      throw new NotFoundException('Item do checklist não encontrado');
    }
    return item;
  }
}
