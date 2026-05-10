import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import {
  applyContractScopeFilter,
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';
import {
  Contract,
  Inspection,
  InvestmentWork,
  PendingAdjustment,
  Team,
} from '../entities';
import { PendingStatus } from '../common/enums';
import {
  CreateInvestmentWorkDto,
  FilterInvestmentWorksDto,
  UpdateInvestmentWorkDto,
} from './dto';

@Injectable()
export class InvestmentWorksService {
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
  ) {}

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
      .leftJoinAndSelect('investmentWork.contract', 'contract');

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

    const [data, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy('investmentWork.createdAt', 'DESC')
      .getManyAndCount();

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

    return {
      ...investmentWork,
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
      workName: dto.workName.trim(),
      address: dto.address.trim(),
      district: dto.district.trim(),
      basin: dto.basin.trim(),
      service: dto.service.trim(),
      materialNetwork: dto.materialNetwork.trim(),
      singularities: dto.singularities?.trim() || null,
      createdByUserId: user.id,
      active: true,
    });

    const saved = await this.investmentWorkRepository.save(investmentWork);
    return this.findOneScoped(saved.id, user);
  }

  async update(
    id: string,
    dto: UpdateInvestmentWorkDto,
    user: any,
  ): Promise<InvestmentWork> {
    const investmentWork = await this.findOneScoped(id, user);

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
      ...dto,
      workName: dto.workName?.trim(),
      address: dto.address?.trim(),
      district: dto.district?.trim(),
      basin: dto.basin?.trim(),
      service: dto.service?.trim(),
      materialNetwork: dto.materialNetwork?.trim(),
      singularities:
        dto.singularities === undefined ? undefined : dto.singularities.trim(),
      contractId: nextContractId,
      teamId: nextTeamId,
    };

    if (dto.singularities !== undefined && !dto.singularities.trim()) {
      updatePayload.singularities = null;
    }

    await this.investmentWorkRepository.update(
      investmentWork.id,
      updatePayload,
    );
    return this.findOneScoped(investmentWork.id, user);
  }

  async remove(id: string, user: any): Promise<void> {
    const investmentWork = await this.findOneScoped(id, user);

    const inspectionsCount = await this.inspectionRepository.count({
      where: { investmentWorkId: investmentWork.id },
    });
    if (inspectionsCount > 0) {
      throw new BadRequestException(
        'Não é possível remover obra com inspeções vinculadas',
      );
    }

    await this.investmentWorkRepository.delete(investmentWork.id);
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
