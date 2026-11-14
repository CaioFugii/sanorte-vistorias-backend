import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { Contract, Coordinator, FieldSupervisor } from '../entities';

export type CoordinatorContractSummary = {
  id: string;
  name: string;
};

export type CoordinatorResponse = {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  contracts: CoordinatorContractSummary[];
};

@Injectable()
export class CoordinatorsService {
  constructor(
    @InjectRepository(Coordinator)
    private coordinatorsRepository: Repository<Coordinator>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
    @InjectRepository(FieldSupervisor)
    private fieldSupervisorsRepository: Repository<FieldSupervisor>,
  ) {}

  async findAll(
    name?: string,
    active?: boolean,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<CoordinatorResponse>> {
    const skip = (page - 1) * limit;
    const query = this.coordinatorsRepository.createQueryBuilder('coordinator');
    const trimmedName = name?.trim() ?? '';

    if (trimmedName.length >= 3) {
      query.andWhere('coordinator.name ILIKE :name', { name: `%${trimmedName}%` });
    }
    if (active !== undefined) {
      query.andWhere('coordinator.active = :active', { active });
    }

    const [rows, total] = await query
      .orderBy('coordinator.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const hydrated = await this.loadWithContracts(rows);
    const totalPages = Math.ceil(total / limit);

    return {
      data: hydrated.map((row) => this.toResponse(row)),
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

  async findOne(id: string): Promise<CoordinatorResponse> {
    const coordinator = await this.coordinatorsRepository.findOne({
      where: { id },
      relations: ['contracts'],
    });
    if (!coordinator) {
      throw new NotFoundException('Coordenador não encontrado');
    }
    return this.toResponse(coordinator);
  }

  async create(input: {
    name: string;
    active?: boolean;
    contractIds: string[];
  }): Promise<CoordinatorResponse> {
    this.ensureContractIds(input.contractIds);
    const name = this.normalizeName(input.name);
    const contracts = await this.resolveContracts(input.contractIds);

    const saved = await this.coordinatorsRepository.save(
      this.coordinatorsRepository.create({
        name,
        active: input.active ?? true,
        contracts,
      }),
    );

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    input: { name?: string; active?: boolean; contractIds: string[] },
  ): Promise<CoordinatorResponse> {
    this.ensureContractIds(input.contractIds);
    const existing = await this.coordinatorsRepository.findOne({
      where: { id },
      relations: ['contracts'],
    });
    if (!existing) {
      throw new NotFoundException('Coordenador não encontrado');
    }

    if (input.name !== undefined) {
      existing.name = this.normalizeName(input.name);
    }
    if (input.active !== undefined) {
      existing.active = input.active;
    }
    existing.contracts = await this.resolveContracts(input.contractIds);

    await this.coordinatorsRepository.save(existing);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.coordinatorsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coordenador não encontrado');
    }

    const linkedSupervisors = await this.fieldSupervisorsRepository.count({
      where: { coordinatorId: id },
    });
    if (linkedSupervisors > 0) {
      throw new ConflictException(
        'Não é possível excluir um coordenador vinculado a supervisores de campo',
      );
    }

    try {
      await this.coordinatorsRepository.delete(id);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir um coordenador vinculado a supervisores de campo',
        );
      }
      throw error;
    }
  }

  private async loadWithContracts(rows: Coordinator[]): Promise<Coordinator[]> {
    if (rows.length === 0) {
      return [];
    }

    const loaded = await this.coordinatorsRepository.find({
      where: { id: In(rows.map((row) => row.id)) },
      relations: ['contracts'],
    });
    const byId = new Map(loaded.map((row) => [row.id, row]));
    return rows.map((row) => byId.get(row.id) ?? row);
  }

  private toResponse(coordinator: Coordinator): CoordinatorResponse {
    return {
      id: coordinator.id,
      name: coordinator.name,
      active: coordinator.active,
      createdAt: coordinator.createdAt,
      updatedAt: coordinator.updatedAt,
      contracts: (coordinator.contracts ?? []).map((contract) => ({
        id: contract.id,
        name: contract.name,
      })),
    };
  }

  private ensureContractIds(contractIds: string[]): void {
    if (!Array.isArray(contractIds)) {
      throw new BadRequestException('contractIds é obrigatório');
    }
  }

  private normalizeName(name?: string): string {
    const normalized = name?.trim();
    if (!normalized) {
      throw new BadRequestException('Nome do coordenador é obrigatório');
    }
    return normalized;
  }

  private async resolveContracts(contractIds: string[]): Promise<Contract[]> {
    const uniqueIds = [...new Set(contractIds)];
    if (uniqueIds.length === 0) {
      return [];
    }

    const contracts = await this.contractsRepository.findBy({
      id: In(uniqueIds),
    });

    if (contracts.length !== uniqueIds.length) {
      throw new BadRequestException('Um ou mais contractIds informados não existem');
    }

    return contracts;
  }

  private isForeignKeyViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string } }
    ).driverError;

    return driverError?.code === '23503';
  }
}
