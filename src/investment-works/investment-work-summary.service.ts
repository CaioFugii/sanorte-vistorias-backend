import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  applyContractScopeFilter,
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';
import {
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  InvestmentWorkOrigin,
  InvestmentWorkStatus,
  ModuleType,
} from '../common/enums';
import {
  clampToCurrentMonth,
  monthDateRange,
  previousYearMonth,
  referenceMonthFromRange,
} from '../common/utils/sao-paulo-period';
import { Inspection, InvestmentWork } from '../entities';
import { InvestmentWorkSummaryQueryDto } from './dto';

type Period = { from: string; to: string };

@Injectable()
export class InvestmentWorkSummaryService {
  constructor(
    @InjectRepository(InvestmentWork)
    private readonly investmentWorkRepository: Repository<InvestmentWork>,
  ) {}

  async summarize(
    user: any,
    filters: InvestmentWorkSummaryQueryDto = {},
    now = new Date(),
  ) {
    const reference = clampToCurrentMonth(
      referenceMonthFromRange(filters.from, filters.to),
      now,
    );
    const fieldPeriod = monthDateRange(reference.year, reference.month);
    const previous = previousYearMonth(reference.year, reference.month);
    const postWorkPeriod = monthDateRange(previous.year, previous.month);

    const field = await this.aggregate(
      user,
      filters,
      fieldPeriod,
      InvestmentWorkOrigin.MANUAL,
      (query) =>
        `COALESCE(SUM(LEAST(4, ${this.realizedInspectionSubquery(query, 'COUNT(*)')})), 0)`,
    );
    const postWork = await this.aggregate(
      user,
      filters,
      postWorkPeriod,
      InvestmentWorkOrigin.IMPORT,
      (query) =>
        `COUNT(*) FILTER (WHERE EXISTS ${this.realizedInspectionSubquery(query, '1')})`,
    );

    return {
      field: { period: fieldPeriod, ...field },
      postWork: { period: postWorkPeriod, ...postWork },
    };
  }

  private async aggregate(
    user: any,
    filters: InvestmentWorkSummaryQueryDto,
    period: Period,
    origin: InvestmentWorkOrigin,
    doneSql: (query: SelectQueryBuilder<InvestmentWork>) => string,
  ): Promise<{ goal: number; done: number }> {
    const query = this.investmentWorkRepository
      .createQueryBuilder('investmentWork')
      .leftJoin('investmentWork.team', 'team');
    const goalSql =
      origin === InvestmentWorkOrigin.MANUAL ? 'COUNT(*) * 4' : 'COUNT(*)';
    query
      .select(goalSql, 'goal')
      .addSelect(doneSql(query), 'done')
      .where('investmentWork.origin = :origin', { origin })
      .andWhere('investmentWork.active = true')
      .andWhere('investmentWork.status <> :cancelled', {
        cancelled: InvestmentWorkStatus.CANCELADA,
      })
      .andWhere(
        'investmentWork.expectedEndDate BETWEEN :periodFrom AND :periodTo',
        { periodFrom: period.from, periodTo: period.to },
      );
    query.setParameter('obrasModule', ModuleType.OBRAS_INVESTIMENTO);
    query.setParameter('draftStatus', InspectionStatus.RASCUNHO);
    query.setParameter(
      'evaluationModule',
      origin === InvestmentWorkOrigin.MANUAL
        ? InvestmentWorkEvaluationModule.CAMPO
        : InvestmentWorkEvaluationModule.POS_OBRA,
    );
    this.applyFilters(query, user, filters);

    const row = await query.getRawOne<{ goal: string | null; done: string | null }>();
    return {
      goal: Number(row?.goal ?? 0),
      done: Number(row?.done ?? 0),
    };
  }

  private realizedInspectionSubquery(
    query: SelectQueryBuilder<InvestmentWork>,
    select: string,
  ): string {
    return query
      .subQuery()
      .select(select)
      .from(Inspection, 'realizedInspection')
      .where('realizedInspection.investmentWorkId = investmentWork.id')
      .andWhere('realizedInspection.module = :obrasModule')
      .andWhere('realizedInspection.evaluationModule = :evaluationModule')
      .andWhere('realizedInspection.status <> :draftStatus')
      .getQuery();
  }

  private applyFilters(
    query: SelectQueryBuilder<InvestmentWork>,
    user: any,
    filters: InvestmentWorkSummaryQueryDto,
  ): void {
    applyContractScopeFilter(
      query,
      getAllowedContractIds(user),
      'investmentWork.contractId',
    );
    if (filters.contractId) {
      query.andWhere('investmentWork.contractId = :contractId', {
        contractId: filters.contractId,
      });
    }
    const address = this.searchableTerm(filters.address);
    if (address) {
      query.andWhere('investmentWork.address ILIKE :address', {
        address: `%${address}%`,
      });
    }
    const district = this.searchableTerm(filters.district);
    if (district) {
      query.andWhere('investmentWork.district ILIKE :district', {
        district: `%${district}%`,
      });
    }
    const pdaTeam = this.searchableTerm(filters.pdaTeam);
    if (pdaTeam) {
      query.andWhere(
        '(investmentWork.pdaTeamName ILIKE :pdaTeam OR team.name ILIKE :pdaTeam)',
        { pdaTeam: `%${pdaTeam}%` },
      );
    }
    if (filters.postWork !== undefined) {
      const exists = `EXISTS ${query
        .subQuery()
        .select('1')
        .from(Inspection, 'summaryPostWork')
        .where('summaryPostWork.investmentWorkId = investmentWork.id')
        .andWhere('summaryPostWork.module = :obrasModule')
        .andWhere('summaryPostWork.evaluationModule = :posObraEvaluation')
        .andWhere('summaryPostWork.status <> :draftStatus')
        .getQuery()}`;
      query.setParameter(
        'posObraEvaluation',
        InvestmentWorkEvaluationModule.POS_OBRA,
      );
      query.andWhere(filters.postWork ? exists : `NOT ${exists}`);
    }
  }

  private searchableTerm(value?: string): string | undefined {
    const term = value?.trim() ?? '';
    return term.length >= 3 ? term : undefined;
  }
}
