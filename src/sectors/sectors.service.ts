import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sector, Collaborator, Checklist, ServiceOrder } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class SectorsService {
  constructor(
    @InjectRepository(Sector)
    private sectorsRepository: Repository<Sector>,
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
    @InjectRepository(ServiceOrder)
    private serviceOrdersRepository: Repository<ServiceOrder>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Sector>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.sectorsRepository.findAndCount({
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

  async findOne(id: string): Promise<Sector> {
    return this.sectorsRepository.findOne({ where: { id } });
  }

  async create(sectorData: { name: string; active?: boolean }): Promise<Sector> {
    await this.ensureUniqueName(sectorData.name);
    const sector = this.sectorsRepository.create(sectorData);
    return this.sectorsRepository.save(sector);
  }

  async update(id: string, sectorData: Partial<Sector>): Promise<Sector> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException('Setor não encontrado');
    }

    if (sectorData.name && sectorData.name !== existing.name) {
      await this.ensureUniqueName(sectorData.name, id);
    }

    await this.sectorsRepository.update(id, sectorData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const sector = await this.findOne(id);
    if (!sector) {
      throw new NotFoundException('Setor não encontrado');
    }

    const [linkedCollaborators, linkedChecklists, linkedServiceOrders] =
      await Promise.all([
        this.collaboratorsRepository.count({ where: { sectorId: id } }),
        this.checklistsRepository.count({ where: { sectorId: id } }),
        this.serviceOrdersRepository.count({ where: { sectorId: id } }),
      ]);

    if (
      linkedCollaborators > 0 ||
      linkedChecklists > 0 ||
      linkedServiceOrders > 0
    ) {
      throw new BadRequestException(
        'Não é possível deletar setor vinculado a colaboradores, checklists ou ordens de serviço',
      );
    }

    await this.sectorsRepository.delete(id);
  }

  private async ensureUniqueName(name: string, ignoreId?: string): Promise<void> {
    const existing = await this.sectorsRepository.findOne({ where: { name } });
    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException('Já existe um setor com este nome');
    }
  }
}
