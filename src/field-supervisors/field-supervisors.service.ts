import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { Contract, Coordinator, FieldSupervisor, Foreman } from '../entities';

export type FieldSupervisorContractSummary = {
  id: string;
  name: string;
};

export type FieldSupervisorCoordinatorSummary = {
  id: string;
  name: string;
};

export type FieldSupervisorResponse = {
  id: string;
  name: string;
  active: boolean;
  coordinatorId: string;
  coordinator: FieldSupervisorCoordinatorSummary;
  createdAt: Date;
  updatedAt: Date;
  contracts: FieldSupervisorContractSummary[];
};

@Injectable()
export class FieldSupervisorsService {
  constructor(
    @InjectRepository(FieldSupervisor)
    private fieldSupervisorsRepository: Repository<FieldSupervisor>,
    @InjectRepository(Coordinator)
    private coordinatorsRepository: Repository<Coordinator>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
    @InjectRepository(Foreman)
    private foremenRepository: Repository<Foreman>,
  ) {}

  async findAll(
    name?: string,
    active?: boolean,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<FieldSupervisorResponse>> {
    const skip = (page - 1) * limit;
    const query = this.fieldSupervisorsRepository.createQueryBuilder('fieldSupervisor');
    const trimmedName = name?.trim() ?? '';

    if (trimmedName.length >= 3) {
      query.andWhere('fieldSupervisor.name ILIKE :name', {
        name: `%${trimmedName}%`,
      });
    }
    if (active !== undefined) {
      query.andWhere('fieldSupervisor.active = :active', { active });
    }

    const [rows, total] = await query
      .orderBy('fieldSupervisor.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const hydrated = await this.loadWithRelations(rows);
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

  async findOne(id: string): Promise<FieldSupervisorResponse> {
    const fieldSupervisor = await this.fieldSupervisorsRepository.findOne({
      where: { id },
      relations: ['coordinator', 'contracts'],
    });
    if (!fieldSupervisor) {
      throw new NotFoundException('Supervisor de campo não encontrado');
    }
    return this.toResponse(fieldSupervisor);
  }

  async create(input: {
    name: string;
    active?: boolean;
    coordinatorId: string;
    contractIds: string[];
  }): Promise<FieldSupervisorResponse> {
    await this.ensureCoordinator(input.coordinatorId);
    this.ensureContractIds(input.contractIds);
    const name = this.normalizeName(input.name);
    const contracts = await this.resolveContracts(input.contractIds);

    const saved = await this.fieldSupervisorsRepository.save(
      this.fieldSupervisorsRepository.create({
        name,
        active: input.active ?? true,
        coordinatorId: input.coordinatorId,
        contracts,
      }),
    );

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    input: {
      name?: string;
      active?: boolean;
      coordinatorId: string;
      contractIds: string[];
    },
  ): Promise<FieldSupervisorResponse> {
    await this.ensureCoordinator(input.coordinatorId);
    this.ensureContractIds(input.contractIds);
    const existing = await this.fieldSupervisorsRepository.findOne({
      where: { id },
      relations: ['contracts'],
    });
    if (!existing) {
      throw new NotFoundException('Supervisor de campo não encontrado');
    }

    if (input.name !== undefined) {
      existing.name = this.normalizeName(input.name);
    }
    if (input.active !== undefined) {
      existing.active = input.active;
    }
    existing.coordinatorId = input.coordinatorId;
    existing.contracts = await this.resolveContracts(input.contractIds);

    await this.fieldSupervisorsRepository.save(existing);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.fieldSupervisorsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Supervisor de campo não encontrado');
    }

    const linkedForemen = await this.foremenRepository.count({
      where: { fieldSupervisorId: id },
    });
    if (linkedForemen > 0) {
      throw new ConflictException(
        'Não é possível excluir um supervisor de campo vinculado a encarregados',
      );
    }

    try {
      await this.fieldSupervisorsRepository.delete(id);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Não é possível excluir um supervisor de campo vinculado a encarregados',
        );
      }
      throw error;
    }
  }

  private async loadWithRelations(rows: FieldSupervisor[]): Promise<FieldSupervisor[]> {
    if (rows.length === 0) {
      return [];
    }

    const loaded = await this.fieldSupervisorsRepository.find({
      where: { id: In(rows.map((row) => row.id)) },
      relations: ['coordinator', 'contracts'],
    });
    const byId = new Map(loaded.map((row) => [row.id, row]));
    return rows.map((row) => byId.get(row.id) ?? row);
  }

  private toResponse(fieldSupervisor: FieldSupervisor): FieldSupervisorResponse {
    return {
      id: fieldSupervisor.id,
      name: fieldSupervisor.name,
      active: fieldSupervisor.active,
      coordinatorId: fieldSupervisor.coordinatorId,
      coordinator: {
        id: fieldSupervisor.coordinator?.id ?? fieldSupervisor.coordinatorId,
        name: fieldSupervisor.coordinator?.name ?? '',
      },
      createdAt: fieldSupervisor.createdAt,
      updatedAt: fieldSupervisor.updatedAt,
      contracts: (fieldSupervisor.contracts ?? []).map((contract) => ({
        id: contract.id,
        name: contract.name,
      })),
    };
  }

  private async ensureCoordinator(coordinatorId?: string): Promise<void> {
    if (!coordinatorId) {
      throw new BadRequestException('coordinatorId é obrigatório');
    }

    const exists = await this.coordinatorsRepository.exist({
      where: { id: coordinatorId },
    });
    if (!exists) {
      throw new BadRequestException('coordinatorId informado não existe');
    }
  }

  private ensureContractIds(contractIds: string[]): void {
    if (!Array.isArray(contractIds)) {
      throw new BadRequestException('contractIds é obrigatório');
    }
  }

  private normalizeName(name?: string): string {
    const normalized = name?.trim();
    if (!normalized) {
      throw new BadRequestException('Nome do supervisor de campo é obrigatório');
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
