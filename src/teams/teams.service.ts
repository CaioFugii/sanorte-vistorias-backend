import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike, QueryFailedError } from 'typeorm';
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
    name?: string,
  ): Promise<PaginatedResponseDto<Team>> {
    const skip = (page - 1) * limit;
    const trimmedName = name?.trim();

    const [data, total] = await this.teamsRepository.findAndCount({
      where: {
        active: true,
        ...(trimmedName ? { name: ILike(`%${trimmedName}%`) } : {}),
      },
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
    const normalizedName = this.normalizeTeamName(baseData.name);
    await this.ensureTeamNameIsAvailable(normalizedName);

    const team = this.teamsRepository.create({
      ...baseData,
      name: normalizedName,
    });

    if (collaboratorIds !== undefined) {
      team.collaborators = await this.resolveCollaborators(collaboratorIds);
    }

    let saved: Team;
    try {
      saved = await this.teamsRepository.save(team);
    } catch (error) {
      if (this.isTeamNameUniqueViolation(error)) {
        this.throwTeamNameAlreadyExists();
      }

      throw error;
    }

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    teamData: Partial<Team> & { collaboratorIds?: string[] },
  ): Promise<Team> {
    const { collaboratorIds, ...baseData } = teamData;
    const dataToUpdate = { ...baseData };

    if (dataToUpdate.name !== undefined) {
      const normalizedName = this.normalizeTeamName(dataToUpdate.name);
      await this.ensureTeamNameIsAvailable(normalizedName, id);
      dataToUpdate.name = normalizedName;
    }

    if (Object.keys(dataToUpdate).length > 0) {
      try {
        await this.teamsRepository.update(id, dataToUpdate);
      } catch (error) {
        if (this.isTeamNameUniqueViolation(error)) {
          this.throwTeamNameAlreadyExists();
        }

        throw error;
      }
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

  private async resolveCollaborators(
    collaboratorIds: string[],
  ): Promise<Collaborator[]> {
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

  private normalizeTeamName(name?: string): string {
    const normalized = name?.trim();

    if (!normalized) {
      throw new BadRequestException('Nome da equipe é obrigatório');
    }

    return normalized;
  }

  private async ensureTeamNameIsAvailable(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const query = this.teamsRepository
      .createQueryBuilder('team')
      .where('LOWER(BTRIM(team.name)) = LOWER(BTRIM(:name))', { name });

    if (excludeId) {
      query.andWhere('team.id <> :excludeId', { excludeId });
    }

    const existingTeam = await query.getOne();
    if (existingTeam) {
      this.throwTeamNameAlreadyExists();
    }
  }

  private isTeamNameUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (
      error as QueryFailedError & {
        driverError?: { code?: string; constraint?: string };
      }
    ).driverError;

    return (
      driverError?.code === '23505' &&
      driverError.constraint === 'UQ_teams_name_normalized'
    );
  }

  private throwTeamNameAlreadyExists(): never {
    throw new BadRequestException('Já existe uma equipe com este nome');
  }
}
