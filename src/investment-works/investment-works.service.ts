import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import {
  applyContractScopeFilter,
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';
import {
  Contract,
  Inspection,
  InvestmentWork,
  InvestmentWorkDescription,
  PendingAdjustment,
  Team,
} from '../entities';
import {
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  InvestmentWorkOrigin,
  ModuleType,
  PendingStatus,
} from '../common/enums';
import {
  CreateInvestmentWorkDto,
  FilterInvestmentWorksDto,
  UpdateInvestmentWorkDto,
} from './dto';

@Injectable()
export class InvestmentWorksService {
  private readonly logger = new Logger(InvestmentWorksService.name);

  constructor(
    @InjectRepository(InvestmentWork)
    private readonly investmentWorkRepository: Repository<InvestmentWork>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Inspection)
    private readonly inspectionRepository: Repository<Inspection>,
    @InjectRepository(PendingAdjustment)
    private readonly pendingAdjustmentRepository: Repository<PendingAdjustment>,
    @InjectRepository(InvestmentWorkDescription)
    private readonly descriptionRepository: Repository<InvestmentWorkDescription>,
  ) {}

  private static readonly importEditableFields = new Set([
    'address',
    'district',
    'pdaTeamName',
    'expectedEndDate',
    'status',
    'active',
  ]);

  async findAll(
    user: any,
    page: number = 1,
    limit: number = 10,
    filters?: FilterInvestmentWorksDto,
  ): Promise<PaginatedResponseDto<InvestmentWork>> {
    const skip = (page - 1) * limit;
    const allowedContractIds = getAllowedContractIds(user);

    const query = this.investmentWorkRepository
      .createQueryBuilder('investmentWork')
      .leftJoinAndSelect('investmentWork.team', 'team')
      .leftJoinAndSelect('investmentWork.contract', 'contract')
      .leftJoinAndSelect('investmentWork.sector', 'sector');

    if (filters?.status) {
      query.andWhere('investmentWork.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.contractId) {
      query.andWhere('investmentWork.contractId = :contractId', {
        contractId: filters.contractId,
      });
    }

    if (filters?.active !== undefined) {
      query.andWhere('investmentWork.active = :active', {
        active: filters.active,
      });
    }

    if (filters?.origin) {
      query.andWhere('investmentWork.origin = :origin', {
        origin: filters.origin,
      });
    }

    if (filters?.from) {
      query.andWhere('investmentWork.expectedEndDate >= :from', {
        from: filters.from,
      });
    }

    if (filters?.to) {
      query.andWhere('investmentWork.expectedEndDate <= :to', {
        to: filters.to,
      });
    }

    const address = this.searchableTerm(filters?.address);
    if (address) {
      query.andWhere('investmentWork.address ILIKE :address', {
        address: `%${address}%`,
      });
    }

    const district = this.searchableTerm(filters?.district);
    if (district) {
      query.andWhere('investmentWork.district ILIKE :district', {
        district: `%${district}%`,
      });
    }

    const pdaTeam = this.searchableTerm(filters?.pdaTeam);
    if (pdaTeam) {
      query.andWhere(
        '(investmentWork.pdaTeamName ILIKE :pdaTeam OR team.name ILIKE :pdaTeam)',
        { pdaTeam: `%${pdaTeam}%` },
      );
    }

    if (filters?.postWork !== undefined) {
      const exists = this.realizedPostWorkExists(query);
      query.setParameter('obrasModule', ModuleType.OBRAS_INVESTIMENTO);
      query.setParameter(
        'posObraEvaluation',
        InvestmentWorkEvaluationModule.POS_OBRA,
      );
      query.setParameter('draftStatus', InspectionStatus.RASCUNHO);
      query.andWhere(filters.postWork ? exists : `NOT ${exists}`);
    }

    if (filters?.search?.trim()) {
      query.andWhere(
        '(investmentWork.workName ILIKE :search OR investmentWork.address ILIKE :search OR investmentWork.district ILIKE :search OR investmentWork.service ILIKE :search)',
        { search: `%${filters.search.trim()}%` },
      );
    }

    applyContractScopeFilter(
      query,
      allowedContractIds,
      'investmentWork.contractId',
    );

    if (filters?.from || filters?.to) {
      query
        .orderBy('investmentWork.expectedEndDate', 'ASC')
        .addOrderBy('investmentWork.workName', 'ASC');
    } else {
      query.orderBy('investmentWork.createdAt', 'DESC');
    }

    const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

    const workIds = data.map((work) => work.id);
    const [averagesByWorkId, countsByWorkId] = await Promise.all([
      this.findAverageScoreByWorkIds(workIds),
      this.findRealizedInspectionCountsByWorkIds(workIds),
    ]);
    const dataWithAverages = data.map((work) => {
      const counts = countsByWorkId.get(work.id);
      return {
        ...work,
        averageScorePercent: averagesByWorkId.get(work.id) ?? null,
        fieldInspectionCount: counts?.field ?? 0,
        postWorkInspectionCount: counts?.postWork ?? 0,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: dataWithAverages,
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

  async findOne(id: string, user: any) {
    const investmentWork = await this.findOneScoped(id, user);

    const [inspectionTotal, avgScore, lastInspections, pendingTotal] =
      await Promise.all([
        this.inspectionRepository.count({
          where: { investmentWorkId: investmentWork.id },
        }),
        this.inspectionRepository
          .createQueryBuilder('inspection')
          .select('AVG(inspection.score_percent)', 'avgScore')
          .where('inspection.investment_work_id = :investmentWorkId', {
            investmentWorkId: investmentWork.id,
          })
          .getRawOne<{ avgScore: string | null }>(),
        this.inspectionRepository.find({
          where: { investmentWorkId: investmentWork.id },
          select: {
            id: true,
            module: true,
            status: true,
            scorePercent: true,
            createdAt: true,
            serviceOrderId: true,
          },
          relations: ['serviceOrder'],
          order: { createdAt: 'DESC' },
          take: 5,
        }),
        this.pendingAdjustmentRepository
          .createQueryBuilder('pending')
          .innerJoin('pending.inspection', 'inspection')
          .where('inspection.investment_work_id = :investmentWorkId', {
            investmentWorkId: investmentWork.id,
          })
          .andWhere('pending.status = :pendingStatus', {
            pendingStatus: PendingStatus.PENDENTE,
          })
          .getCount(),
      ]);

    const descriptionLabels =
      investmentWork.origin === InvestmentWorkOrigin.IMPORT
        ? await this.loadDescriptionLabels(investmentWork.id)
        : undefined;

    return {
      ...investmentWork,
      ...(descriptionLabels ? { descriptions: descriptionLabels } : {}),
      inspectionStats: {
        total: inspectionTotal,
        averageScorePercent:
          avgScore?.avgScore == null ? null : Number(avgScore.avgScore),
        averagePercentual:
          avgScore?.avgScore == null ? null : Number(avgScore.avgScore),
        lastInspections: lastInspections.map((inspection) => ({
          id: inspection.id,
          module: inspection.module,
          status: inspection.status,
          scorePercent:
            inspection.scorePercent == null
              ? null
              : Number(inspection.scorePercent),
          createdAt: inspection.createdAt,
          serviceOrder: inspection.serviceOrder
            ? {
                id: inspection.serviceOrder.id,
                osNumber: inspection.serviceOrder.osNumber,
              }
            : null,
        })),
        pendingTotal,
      },
    };
  }

  async create(
    dto: CreateInvestmentWorkDto,
    user: any,
  ): Promise<InvestmentWork> {
    this.validateDateRange(dto.startDate, dto.expectedEndDate);
    await this.ensureContractExists(dto.contractId);
    this.ensureContractAccess(user, dto.contractId);
    await this.ensureTeamIsValidForContract(dto.teamId, dto.contractId);

    const investmentWork = this.investmentWorkRepository.create({
      ...dto,
      origin: InvestmentWorkOrigin.MANUAL,
      workName: dto.workName.trim(),
      address: dto.address.trim(),
      district: dto.district.trim(),
      basin: this.optionalText(dto.basin) ?? null,
      service: dto.service.trim(),
      materialNetwork: this.optionalText(dto.materialNetwork) ?? null,
      singularities: this.optionalText(dto.singularities) ?? null,
      createdByUserId: user.id,
      active: true,
    });

    const saved = await this.investmentWorkRepository.save(investmentWork);
    this.logger.log('Investment work created', {
      investmentWorkId: saved.id,
      contractId: saved.contractId,
      teamId: saved.teamId,
      createdByUserId: user.id,
    });
    return this.findOneScoped(saved.id, user);
  }

  async update(
    id: string,
    dto: UpdateInvestmentWorkDto,
    user: any,
  ): Promise<InvestmentWork> {
    const investmentWork = await this.findOneScoped(id, user);
    if (investmentWork.origin === InvestmentWorkOrigin.IMPORT) {
      return this.updateImported(investmentWork, dto, user);
    }

    const nextContractId = dto.contractId ?? investmentWork.contractId;
    const nextTeamId = dto.teamId ?? investmentWork.teamId;
    const nextStartDate = dto.startDate ?? investmentWork.startDate;
    const nextExpectedEndDate =
      dto.expectedEndDate ?? investmentWork.expectedEndDate;

    this.validateDateRange(nextStartDate, nextExpectedEndDate);
    await this.ensureContractExists(nextContractId);
    this.ensureContractAccess(user, nextContractId);
    await this.ensureTeamIsValidForContract(nextTeamId, nextContractId);

    const updatePayload: Partial<InvestmentWork> = {
      workName: dto.workName?.trim(),
      startDate: dto.startDate,
      expectedEndDate: dto.expectedEndDate,
      address: dto.address?.trim(),
      district: dto.district?.trim(),
      service: dto.service?.trim(),
      contractId: nextContractId,
      teamId: nextTeamId,
      status: dto.status,
      active: dto.active,
    };
    if (dto.basin !== undefined) {
      updatePayload.basin = dto.basin.trim() || null;
    }
    if (dto.materialNetwork !== undefined) {
      updatePayload.materialNetwork = dto.materialNetwork.trim() || null;
    }
    if (dto.singularities !== undefined) {
      updatePayload.singularities = dto.singularities.trim() || null;
    }

    await this.investmentWorkRepository.update(
      investmentWork.id,
      updatePayload,
    );
    this.logger.log('Investment work updated', {
      investmentWorkId: investmentWork.id,
      contractId: nextContractId,
      teamId: nextTeamId,
      updatedByUserId: user.id,
      updatedFields: Object.keys(dto),
    });
    return this.findOneScoped(investmentWork.id, user);
  }

  async remove(id: string, user: any): Promise<void> {
    const investmentWork = await this.findOneScoped(id, user);

    const inspectionsCount = await this.inspectionRepository.count({
      where: { investmentWorkId: investmentWork.id },
    });
    if (inspectionsCount > 0) {
      this.logger.warn(
        'Investment work removal blocked due linked inspections',
        {
          investmentWorkId: investmentWork.id,
          inspectionsCount,
          userId: user.id,
        },
      );
      throw new BadRequestException(
        'Não é possível remover obra com inspeções vinculadas',
      );
    }

    await this.investmentWorkRepository.manager.transaction(async (manager) => {
      if (investmentWork.origin === InvestmentWorkOrigin.IMPORT) {
        await manager.update(
          InvestmentWorkDescription,
          { investmentWorkId: investmentWork.id },
          { investmentWorkId: null },
        );
      }
      await manager.delete(InvestmentWork, investmentWork.id);
    });
    this.logger.log('Investment work removed', {
      investmentWorkId: investmentWork.id,
      removedByUserId: user.id,
    });
  }

  private async updateImported(
    investmentWork: InvestmentWork,
    dto: UpdateInvestmentWorkDto,
    user: any,
  ): Promise<InvestmentWork> {
    for (const field of Object.keys(dto)) {
      if (!InvestmentWorksService.importEditableFields.has(field)) {
        throw new BadRequestException(
          `Campo não editável em cadastro por Excel: ${field}`,
        );
      }
    }

    const nextExpectedEndDate =
      dto.expectedEndDate ?? investmentWork.expectedEndDate;
    const nextStartDate = dto.expectedEndDate ?? investmentWork.startDate;
    this.validateDateRange(nextStartDate, nextExpectedEndDate);
    this.ensureContractAccess(user, investmentWork.contractId);

    const updatePayload: Partial<InvestmentWork> = {};
    if (dto.address !== undefined) updatePayload.address = dto.address.trim();
    if (dto.district !== undefined) {
      updatePayload.district = dto.district.trim();
    }
    if (dto.pdaTeamName !== undefined) {
      updatePayload.pdaTeamName = dto.pdaTeamName.trim() || null;
    }
    if (dto.expectedEndDate !== undefined) {
      updatePayload.expectedEndDate = dto.expectedEndDate;
      updatePayload.startDate = dto.expectedEndDate;
    }
    if (dto.status !== undefined) updatePayload.status = dto.status;
    if (dto.active !== undefined) updatePayload.active = dto.active;

    try {
      await this.investmentWorkRepository.manager.transaction(async (manager) => {
        await manager.update(InvestmentWork, investmentWork.id, updatePayload);
        if (dto.expectedEndDate !== undefined) {
          await manager.update(
            InvestmentWorkDescription,
            { investmentWorkId: investmentWork.id },
            { executionDate: dto.expectedEndDate },
          );
        }
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(
          'Já existe cadastro por Excel com esta O.S, data e Descrição neste contrato.',
        );
      }
      throw error;
    }

    this.logger.log('Investment work updated', {
      investmentWorkId: investmentWork.id,
      contractId: investmentWork.contractId,
      updatedByUserId: user.id,
      updatedFields: Object.keys(dto),
    });
    return this.findOneScoped(investmentWork.id, user);
  }

  private async loadDescriptionLabels(investmentWorkId: string): Promise<string[]> {
    const rows = await this.descriptionRepository.find({
      where: { investmentWorkId },
      order: { description: 'ASC' },
    });
    return rows.map((row) => row.description);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as {
      code?: string;
      driverError?: { code?: string };
    };
    return candidate.code === '23505' || candidate.driverError?.code === '23505';
  }

  private async findOneScoped(id: string, user: any): Promise<InvestmentWork> {
    const allowedContractIds = getAllowedContractIds(user);

    const query = this.investmentWorkRepository
      .createQueryBuilder('investmentWork')
      .leftJoinAndSelect('investmentWork.team', 'team')
      .leftJoinAndSelect('investmentWork.contract', 'contract')
      .leftJoinAndSelect('investmentWork.createdBy', 'createdBy')
      .where('investmentWork.id = :id', { id });

    applyContractScopeFilter(
      query,
      allowedContractIds,
      'investmentWork.contractId',
    );

    const investmentWork = await query.getOne();
    if (!investmentWork) {
      throw new NotFoundException('Obra de investimento não encontrada');
    }
    return investmentWork;
  }

  private async ensureContractExists(contractId: string): Promise<void> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new BadRequestException('Contrato informado não encontrado');
    }
  }

  private ensureContractAccess(user: any, contractId: string): void {
    const allowedContractIds = getAllowedContractIds(user);
    if (allowedContractIds === null) {
      return;
    }

    if (!allowedContractIds.includes(contractId)) {
      throw new ForbiddenException(
        'Você não tem acesso ao contrato informado para a obra.',
      );
    }
  }

  private async ensureTeamIsValidForContract(
    teamId: string,
    contractId: string,
  ): Promise<void> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['contracts'],
    });

    if (!team) {
      throw new BadRequestException('Equipe informada não encontrada');
    }

    if (!team.active) {
      throw new BadRequestException('Equipe informada está inativa');
    }

    const teamHasContract = (team.contracts || []).some(
      (contract) => contract.id === contractId,
    );

    if (!teamHasContract) {
      throw new BadRequestException(
        'Equipe deve possuir vínculo com o contrato informado',
      );
    }
  }

  private searchableTerm(value?: string): string | undefined {
    const term = value?.trim() ?? '';
    return term.length >= 3 ? term : undefined;
  }

  private realizedPostWorkExists(
    query: SelectQueryBuilder<InvestmentWork>,
  ): string {
    const subquery = query
      .subQuery()
      .select('1')
      .from(Inspection, 'realizedPostWork')
      .where('realizedPostWork.investmentWorkId = investmentWork.id')
      .andWhere('realizedPostWork.module = :obrasModule')
      .andWhere('realizedPostWork.evaluationModule = :posObraEvaluation')
      .andWhere('realizedPostWork.status <> :draftStatus')
      .getQuery();
    return `EXISTS ${subquery}`;
  }

  private async findRealizedInspectionCountsByWorkIds(
    investmentWorkIds: string[],
  ): Promise<Map<string, { field: number; postWork: number }>> {
    const counts = new Map<string, { field: number; postWork: number }>();
    if (investmentWorkIds.length === 0) {
      return counts;
    }

    const rows = await this.inspectionRepository
      .createQueryBuilder('inspection')
      .select('inspection.investmentWorkId', 'investmentWorkId')
      .addSelect('inspection.evaluationModule', 'evaluationModule')
      .addSelect('COUNT(*)', 'total')
      .where('inspection.investmentWorkId IN (:...investmentWorkIds)', {
        investmentWorkIds,
      })
      .andWhere('inspection.module = :module', {
        module: ModuleType.OBRAS_INVESTIMENTO,
      })
      .andWhere('inspection.status <> :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .groupBy('inspection.investmentWorkId')
      .addGroupBy('inspection.evaluationModule')
      .getRawMany<{
        investmentWorkId: string;
        evaluationModule: InvestmentWorkEvaluationModule;
        total: string;
      }>();

    for (const row of rows) {
      if (!row.investmentWorkId) continue;
      const current = counts.get(row.investmentWorkId) ?? {
        field: 0,
        postWork: 0,
      };
      const total = Number(row.total);
      if (row.evaluationModule === InvestmentWorkEvaluationModule.CAMPO) {
        current.field = total;
      }
      if (row.evaluationModule === InvestmentWorkEvaluationModule.POS_OBRA) {
        current.postWork = total;
      }
      counts.set(row.investmentWorkId, current);
    }

    return counts;
  }

  private async findAverageScoreByWorkIds(
    investmentWorkIds: string[],
  ): Promise<Map<string, number>> {
    const averages = new Map<string, number>();
    if (investmentWorkIds.length === 0) {
      return averages;
    }

    const rows = await this.inspectionRepository
      .createQueryBuilder('inspection')
      .select('inspection.investmentWorkId', 'investmentWorkId')
      .addSelect('AVG(inspection.scorePercent)', 'avgScore')
      .where('inspection.investmentWorkId IN (:...investmentWorkIds)', {
        investmentWorkIds,
      })
      .andWhere('inspection.scorePercent IS NOT NULL')
      .groupBy('inspection.investmentWorkId')
      .getRawMany<{ investmentWorkId: string; avgScore: string | null }>();

    for (const row of rows) {
      if (!row.investmentWorkId || row.avgScore == null) {
        continue;
      }
      averages.set(row.investmentWorkId, Number(row.avgScore));
    }

    return averages;
  }

  private optionalText(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value.trim() || null;
  }

  private validateDateRange(startDate: string, expectedEndDate: string): void {
    const start = new Date(startDate);
    const end = new Date(expectedEndDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Datas informadas são inválidas');
    }

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException(
        'expectedEndDate não deve ser menor que startDate',
      );
    }
  }
}
