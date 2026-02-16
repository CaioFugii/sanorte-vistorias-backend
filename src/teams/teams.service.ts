import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Team, Collaborator } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(Collaborator)
    private collaboratorsRepository: Repository<Collaborator>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Team>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.teamsRepository.findAndCount({
      where: { active: true },
      relations: ['collaborators'],
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

  async findOne(id: string): Promise<Team> {
    return this.teamsRepository.findOne({
      where: { id },
      relations: ['collaborators'],
    });
  }

  async create(teamData: {
    name: string;
    active?: boolean;
    collaboratorIds?: string[];
  }): Promise<Team> {
    const { collaboratorIds, ...baseData } = teamData;
    const team = this.teamsRepository.create(baseData);

    if (collaboratorIds !== undefined) {
      team.collaborators = await this.resolveCollaborators(collaboratorIds);
    }

    const saved = await this.teamsRepository.save(team);
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    teamData: Partial<Team> & { collaboratorIds?: string[] },
  ): Promise<Team> {
    const { collaboratorIds, ...baseData } = teamData;

    if (Object.keys(baseData).length > 0) {
      await this.teamsRepository.update(id, baseData);
    }

    if (collaboratorIds !== undefined) {
      const team = await this.findOne(id);
      if (!team) {
        return null;
      }

      team.collaborators = await this.resolveCollaborators(collaboratorIds);
      await this.teamsRepository.save(team);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.teamsRepository.delete(id);
  }

  private async resolveCollaborators(collaboratorIds: string[]): Promise<Collaborator[]> {
    const uniqueIds = [...new Set(collaboratorIds)];
    if (uniqueIds.length === 0) {
      return [];
    }

    const collaborators = await this.collaboratorsRepository.findBy({
      id: In(uniqueIds),
    });

    if (collaborators.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Um ou mais collaboratorIds informados não existem',
      );
    }

    return collaborators;
  }
}
