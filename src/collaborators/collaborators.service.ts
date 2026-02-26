import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collaborator, Sector } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
    @InjectRepository(Sector)
    private sectorsRepository: Repository<Sector>,
  ) {}

  async findAll(
    sectorId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Collaborator>> {
    const skip = (page - 1) * limit;
    const where: Partial<Collaborator> = {};

    if (sectorId) {
      where.sectorId = sectorId;
    }

    const [data, total] = await this.collaboratorsRepository.findAndCount({
      where,
      relations: ['sector'],
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

  async findOne(id: string): Promise<Collaborator> {
    return this.collaboratorsRepository.findOne({
      where: { id },
      relations: ['sector'],
    });
  }

  async create(
    collaboratorData: { name: string; active?: boolean; sectorId?: string },
  ): Promise<Collaborator> {
    await this.validateSector(collaboratorData.sectorId);
    const collaborator = this.collaboratorsRepository.create(collaboratorData);
    const saved = await this.collaboratorsRepository.save(collaborator);
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    collaboratorData: Partial<Collaborator>,
  ): Promise<Collaborator> {
    if (Object.prototype.hasOwnProperty.call(collaboratorData, 'sectorId')) {
      await this.validateSector(collaboratorData.sectorId);
    }

    await this.collaboratorsRepository.update(id, collaboratorData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.collaboratorsRepository.delete(id);
  }

  private async validateSector(sectorId?: string): Promise<void> {
    if (!sectorId) {
      return;
    }

    const sectorExists = await this.sectorsRepository.exist({ where: { id: sectorId } });
    if (!sectorExists) {
      throw new BadRequestException('sectorId informado não existe');
    }
  }
}
