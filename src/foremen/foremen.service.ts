import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { FieldSupervisor, Foreman, Team } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

export type ForemanTeamSummary = {
  id: string;
  name: string;
};

export type ForemanFieldSupervisorSummary = {
  id: string;
  name: string;
};

export type ForemanResponse = {
  id: string;
  name: string;
  active: boolean;
  fieldSupervisorId: string | null;
  fieldSupervisor: ForemanFieldSupervisorSummary | null;
  createdAt: Date;
  updatedAt: Date;
  teams: ForemanTeamSummary[];
};

@Injectable()
export class ForemenService {
  constructor(
    @InjectRepository(Foreman)
    private foremenRepository: Repository<Foreman>,
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(FieldSupervisor)
    private fieldSupervisorsRepository: Repository<FieldSupervisor>,
  ) {}

  async findAll(
    name?: string,
    active?: boolean,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<ForemanResponse>> {
    const skip = (page - 1) * limit;
    const query = this.foremenRepository
      .createQueryBuilder('foreman')
      .leftJoinAndSelect('foreman.fieldSupervisor', 'fieldSupervisor');
    const trimmedName = name?.trim() ?? '';

    if (trimmedName.length >= 3) {
      query.andWhere('foreman.name ILIKE :name', { name: `%${trimmedName}%` });
    }
    if (active !== undefined) {
      query.andWhere('foreman.active = :active', { active });
    }

    const [rows, total] = await query
      .orderBy('foreman.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const teamsByForeman = await this.loadTeamsByForeman(rows.map((row) => row.id));
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((row) => this.toResponse(row, teamsByForeman.get(row.id) ?? [])),
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

  async findOne(id: string): Promise<ForemanResponse> {
    const foreman = await this.foremenRepository.findOne({
      where: { id },
      relations: ['fieldSupervisor'],
    });
    if (!foreman) {
      throw new NotFoundException('Encarregado não encontrado');
    }
    const teamsByForeman = await this.loadTeamsByForeman([id]);
    return this.toResponse(foreman, teamsByForeman.get(id) ?? []);
  }

  async create(input: {
    name: string;
    active?: boolean;
    fieldSupervisorId?: string | null;
  }): Promise<ForemanResponse> {
    const name = this.normalizeName(input.name);
    await this.ensureNameIsAvailable(name);
    if (input.fieldSupervisorId) {
      await this.ensureFieldSupervisorExists(input.fieldSupervisorId);
    }

    let saved: Foreman;
    try {
      saved = await this.foremenRepository.save(
        this.foremenRepository.create({
          name,
          active: input.active ?? true,
          fieldSupervisorId: input.fieldSupervisorId ?? null,
        }),
      );
    } catch (error) {
      if (this.isNameUniqueViolation(error)) {
        this.throwNameAlreadyExists();
      }
      throw error;
    }

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    input: { name?: string; active?: boolean; fieldSupervisorId?: string | null },
  ): Promise<ForemanResponse> {
    const existing = await this.foremenRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Encarregado não encontrado');
    }

    const payload: Partial<Foreman> = {};
    if (input.name !== undefined) {
      const name = this.normalizeName(input.name);
      await this.ensureNameIsAvailable(name, id);
      payload.name = name;
    }
    if (input.active !== undefined) {
      payload.active = input.active;
    }
    if (input.fieldSupervisorId !== undefined) {
      if (input.fieldSupervisorId) {
        await this.ensureFieldSupervisorExists(input.fieldSupervisorId);
      }
      payload.fieldSupervisorId = input.fieldSupervisorId;
    }

    if (Object.keys(payload).length > 0) {
      try {
        await this.foremenRepository.update(id, payload);
      } catch (error) {
        if (this.isNameUniqueViolation(error)) {
          this.throwNameAlreadyExists();
        }
        throw error;
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.foremenRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Encarregado não encontrado');
    }

    const linkedTeams = await this.teamsRepository.count({
      where: { foremanId: id },
    });
    if (linkedTeams > 0) {
      throw new BadRequestException(
        'Não é possível excluir um encarregado vinculado a equipes',
      );
    }

    await this.foremenRepository.delete(id);
  }

  private async loadTeamsByForeman(
    foremanIds: string[],
  ): Promise<Map<string, ForemanTeamSummary[]>> {
    const grouped = new Map<string, ForemanTeamSummary[]>();
    if (foremanIds.length === 0) {
      return grouped;
    }

    const teams = await this.teamsRepository.find({
      where: { foremanId: In(foremanIds) },
      select: ['id', 'name', 'foremanId'],
      order: { name: 'ASC' },
    });

    for (const team of teams) {
      if (!team.foremanId) continue;
      const current = grouped.get(team.foremanId) ?? [];
      current.push({ id: team.id, name: team.name });
      grouped.set(team.foremanId, current);
    }

    return grouped;
  }

  private toResponse(foreman: Foreman, teams: ForemanTeamSummary[]): ForemanResponse {
    return {
      id: foreman.id,
      name: foreman.name,
      active: foreman.active,
      fieldSupervisorId: foreman.fieldSupervisorId ?? null,
      fieldSupervisor: foreman.fieldSupervisor
        ? { id: foreman.fieldSupervisor.id, name: foreman.fieldSupervisor.name }
        : null,
      createdAt: foreman.createdAt,
      updatedAt: foreman.updatedAt,
      teams,
    };
  }

  private async ensureFieldSupervisorExists(fieldSupervisorId: string): Promise<void> {
    const exists = await this.fieldSupervisorsRepository.exist({
      where: { id: fieldSupervisorId },
    });
    if (!exists) {
      throw new BadRequestException('fieldSupervisorId informado não existe');
    }
  }

  private normalizeName(name?: string): string {
    const normalized = name?.trim();
    if (!normalized) {
      throw new BadRequestException('Nome do encarregado é obrigatório');
    }
    return normalized;
  }

  private async ensureNameIsAvailable(name: string, excludeId?: string): Promise<void> {
    const query = this.foremenRepository
      .createQueryBuilder('foreman')
      .where('LOWER(BTRIM(foreman.name)) = LOWER(BTRIM(:name))', { name });

    if (excludeId) {
      query.andWhere('foreman.id <> :excludeId', { excludeId });
    }

    const existing = await query.getOne();
    if (existing) {
      this.throwNameAlreadyExists();
    }
  }

  private isNameUniqueViolation(error: unknown): boolean {
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
      driverError.constraint === 'UQ_foremen_name_normalized'
    );
  }

  private throwNameAlreadyExists(): never {
    throw new BadRequestException('Já existe um encarregado com este nome');
  }
}
