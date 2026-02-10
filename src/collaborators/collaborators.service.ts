import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collaborator } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Collaborator>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.collaboratorsRepository.findAndCount({
      where: { active: true },
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
    return this.collaboratorsRepository.findOne({ where: { id } });
  }

  async create(
    collaboratorData: { name: string; active?: boolean },
  ): Promise<Collaborator> {
    const collaborator = this.collaboratorsRepository.create(collaboratorData);
    return this.collaboratorsRepository.save(collaborator);
  }

  async update(
    id: string,
    collaboratorData: Partial<Collaborator>,
  ): Promise<Collaborator> {
    await this.collaboratorsRepository.update(id, collaboratorData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.collaboratorsRepository.delete(id);
  }
}
