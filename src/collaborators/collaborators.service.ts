import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Collaborator, Contract, Sector } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
    @InjectRepository(Sector)
    private sectorsRepository: Repository<Sector>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
  ) {}

  async findAll(
    name?: string,
    sectorId?: string,
    contractId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Collaborator>> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (sectorId) {
      where.sectorId = sectorId;
    }
    if (contractId) {
      where.contractId = contractId;
    }
    if (name?.trim()) {
      where.name = ILike(`%${name.trim()}%`);
    }

    const [data, total] = await this.collaboratorsRepository.findAndCount({
      where,
      relations: ['sector', 'contract'],
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
      relations: ['sector', 'contract'],
    });
  }

  async create(collaboratorData: {
    name: string;
    active?: boolean;
    sectorId?: string;
    contractId?: string;
  }): Promise<Collaborator> {
    await this.validateSector(collaboratorData.sectorId);
    await this.validateContract(collaboratorData.contractId);
    const collaborator = this.collaboratorsRepository.create({
      ...collaboratorData,
      name: collaboratorData.name.trim().toLocaleUpperCase(),
    });
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
    if (Object.prototype.hasOwnProperty.call(collaboratorData, 'contractId')) {
      await this.validateContract(collaboratorData.contractId);
    }

    const payload = {
      ...collaboratorData,
      ...(typeof collaboratorData.name === 'string'
        ? { name: collaboratorData.name.trim().toLocaleUpperCase() }
        : {}),
    };
    await this.collaboratorsRepository.update(id, payload);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.collaboratorsRepository.delete(id);
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

  private async validateContract(contractId?: string): Promise<void> {
    if (!contractId) {
      return;
    }

    const contractExists = await this.contractsRepository.exist({
      where: { id: contractId },
    });
    if (!contractExists) {
      throw new BadRequestException('contractId informado não existe');
    }
  }
}
