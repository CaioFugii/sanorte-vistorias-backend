import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection, Team } from '../entities';
import { ModuleType, InspectionStatus } from '../common/enums';
import { QualityByServiceResponseDto } from './dto/quality-by-service-response.dto';
import { CurrentMonthByServiceResponseDto } from './dto/current-month-by-service-response.dto';

const MAX_DATE_RANGE_YEARS = 2;
const DASHBOARD_TIMEZONE = 'America/Sao_Paulo';
const QUALITY_RELEVANT_STATUSES = [
  InspectionStatus.FINALIZADA,
  InspectionStatus.PENDENTE_AJUSTE,
  InspectionStatus.RESOLVIDA,
];
const QUALITY_BY_SERVICE_ALLOWED_SECTORS = [
  'AGUA',
  'DESOBSTRUCAO',
  'ESGOTO',
  'HIDROMETRIA',
  'REPOSICAO',
];

/** Converte uma data YYYY-MM-DD para o fim do dia (23:59:59.999) em UTC. */
function toEndOfDay(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function serviceKeyFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function periodMonths(from: string, to: string): string[] {
  const [fromYear, fromMonth] = from.split('-').map((value) => parseInt(value, 10));
  const [toYear, toMonth] = to.split('-').map((value) => parseInt(value, 10));
  const start = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
  const end = new Date(Date.UTC(toYear, toMonth - 1, 1));
  const result: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    result.push(`${year}-${month}`);
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return result;
}

function resolveMonthOrCurrent(month?: string): string {
  if (month) {
    return month;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DASHBOARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const monthValue = parts.find((part) => part.type === 'month')?.value;

  return `${year}-${monthValue}`;
}

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Inspection)
    private inspectionsRepository: Repository<Inspection>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
  ) {}

  private validateDateRange(from: string, to: string): void {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (fromDate > toDate) {
      throw new BadRequestException(
        'A data inicial (from) não pode ser posterior à data final (to).',
      );
    }
    const maxEnd = new Date(fromDate);
    maxEnd.setFullYear(maxEnd.getFullYear() + MAX_DATE_RANGE_YEARS);
    if (toDate > maxEnd) {
      throw new BadRequestException(
        `O intervalo de datas não pode ser maior que ${MAX_DATE_RANGE_YEARS} anos.`,
      );
    }
  }

  private applyQualityFilters(
    qb: any,
    filters: {
      module?: ModuleType;
      teamId?: string;
    },
  ): void {
    if (filters.module) {
      qb.andWhere('inspection.module = :module', { module: filters.module });
    }
    if (filters.teamId) {
      qb.andWhere('inspection.teamId = :teamId', { teamId: filters.teamId });
    }
  }

  async getSummary(filters: {
    from: string;
    to: string;
    module?: ModuleType;
    teamId?: string;
  }) {
    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .select('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingCount',
      )
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE)
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit });

    if (filters.module) {
      qb.andWhere('inspection.module = :module', { module: filters.module });
    }
    if (filters.teamId) {
      qb.andWhere('inspection.teamId = :teamId', { teamId: filters.teamId });
    }

    const row = await qb.getRawOne<{
      inspectionsCount: string;
      pendingCount: string;
      averagePercent: string | null;
    }>();

    const inspectionsCount = parseInt(row?.inspectionsCount ?? '0', 10);
    const pendingCount = parseInt(row?.pendingCount ?? '0', 10);
    const averagePercentRaw = row?.averagePercent;
    const averagePercent =
      averagePercentRaw != null
        ? Math.round(parseFloat(averagePercentRaw) * 100) / 100
        : 0;

    return {
      averagePercent,
      inspectionsCount,
      pendingCount,
    };
  }

  async getTeamsRanking(filters: {
    from: string;
    to: string;
    module?: ModuleType;
  }) {
    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.team', 'team')
      .select('inspection.teamId', 'teamId')
      .addSelect('COALESCE(team.name, :noTeam)', 'teamName')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingCount',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.hasParalysisPenalty = true THEN 1 ELSE 0 END)`,
        'paralyzedCount',
      )
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE)
      .setParameter('noTeam', 'Sem equipe')
      .groupBy('inspection.teamId')
      .addGroupBy('team.name')
      .orderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST')
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit });

    if (filters.module) {
      qb.andWhere('inspection.module = :module', { module: filters.module });
    }

    const rows = await qb.getRawMany<{
      teamId: string;
      teamName: string;
      inspectionsCount: string;
      averagePercent: string | null;
      pendingCount: string;
      paralyzedCount: string;
    }>();

    return rows.map((row) => {
      const inspectionsCount = parseInt(row.inspectionsCount, 10);
      const paralyzedCount = parseInt(row.paralyzedCount, 10);
      const averagePercentRaw = row.averagePercent;
      const averagePercent =
        averagePercentRaw != null
          ? Math.round(parseFloat(averagePercentRaw) * 100) / 100
          : 0;
      const paralysisRatePercent =
        inspectionsCount > 0
          ? Math.round((paralyzedCount / inspectionsCount) * 10000) / 100
          : 0;

      return {
        teamId: row.teamId,
        teamName: row.teamName,
        averagePercent,
        inspectionsCount,
        pendingCount: parseInt(row.pendingCount, 10),
        paralyzedCount,
        paralysisRatePercent,
      };
    });
  }

  async getTeamPerformance(
    teamId: string,
    filters: {
      from: string;
      to: string;
      module?: ModuleType;
    },
  ) {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Equipe não encontrada');
    }

    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .select('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingCount',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.hasParalysisPenalty = true THEN 1 ELSE 0 END)`,
        'paralyzedCount',
      )
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId = :teamId', { teamId })
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE)
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit });

    if (filters.module) {
      qb.andWhere('inspection.module = :module', { module: filters.module });
    }

    const row = await qb.getRawOne<{
      inspectionsCount: string;
      averagePercent: string | null;
      pendingCount: string;
      paralyzedCount: string;
    }>();

    const inspectionsCount = parseInt(row?.inspectionsCount ?? '0', 10);
    const paralyzedCount = parseInt(row?.paralyzedCount ?? '0', 10);
    const averagePercentRaw = row?.averagePercent;
    const averagePercent =
      averagePercentRaw != null
        ? Math.round(parseFloat(averagePercentRaw) * 100) / 100
        : 0;
    const paralysisRatePercent =
      inspectionsCount > 0
        ? Math.round((paralyzedCount / inspectionsCount) * 10000) / 100
        : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      averagePercent,
      inspectionsCount,
      pendingCount: parseInt(row?.pendingCount ?? '0', 10),
      paralyzedCount,
      paralysisRatePercent,
    };
  }

  async getQualityByService(filters: {
    from: string;
    to: string;
    module?: ModuleType;
    teamId?: string;
  }): Promise<QualityByServiceResponseDto> {
    this.validateDateRange(filters.from, filters.to);

    const monthExpr = `to_char(timezone('${DASHBOARD_TIMEZONE}', COALESCE(inspection.finalizedAt, inspection.createdAt)), 'YYYY-MM')`;
    const serviceLabelExpr = `COALESCE(NULLIF(checklistSector.name, ''), NULLIF(serviceOrderSector.name, ''), NULLIF(inspection.serviceDescription, ''), 'SEM_SERVICO')`;
    const dayExpr = `DATE(timezone('${DASHBOARD_TIMEZONE}', COALESCE(inspection.finalizedAt, inspection.createdAt)))`;

    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.checklist', 'checklist')
      .leftJoin('checklist.sector', 'checklistSector')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('serviceOrder.sector', 'serviceOrderSector')
      .select(monthExpr, 'month')
      .addSelect(serviceLabelExpr, 'serviceLabel')
      .addSelect('AVG(inspection.scorePercent)', 'qualityPercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere(`UPPER(TRIM(${serviceLabelExpr})) IN (:...allowedSectors)`, {
        allowedSectors: QUALITY_BY_SERVICE_ALLOWED_SECTORS,
      })
      .andWhere(`${dayExpr} >= :from`, { from: filters.from })
      .andWhere(`${dayExpr} <= :to`, { to: filters.to })
      .groupBy(monthExpr)
      .addGroupBy(serviceLabelExpr)
      .orderBy(monthExpr, 'ASC')
      .addOrderBy(serviceLabelExpr, 'ASC');

    this.applyQualityFilters(qb, {
      module: filters.module,
      teamId: filters.teamId,
    });

    const rows = await qb.getRawMany<{
      month: string;
      serviceLabel: string;
      qualityPercent: string | null;
      inspectionsCount: string;
    }>();

    const period = periodMonths(filters.from, filters.to);
    const byService = new Map<
      string,
      Map<string, { qualityPercent: number; inspectionsCount: number }>
    >();

    for (const row of rows) {
      if (!byService.has(row.serviceLabel)) {
        byService.set(row.serviceLabel, new Map());
      }
      byService.get(row.serviceLabel)!.set(row.month, {
        qualityPercent:
          row.qualityPercent != null ? roundTo2(parseFloat(row.qualityPercent)) : 0,
        inspectionsCount: parseInt(row.inspectionsCount ?? '0', 10),
      });
    }

    const services = Array.from(byService.entries()).map(
      ([serviceLabel, monthMap]) => {
        const series = period.map((month) => {
          const monthData = monthMap.get(month);
          return {
            month,
            qualityPercent: monthData?.qualityPercent ?? 0,
            inspectionsCount: monthData?.inspectionsCount ?? 0,
          };
        });

        const previousIndex = Math.max(series.length - 2, 0);
        const lastIndex = Math.max(series.length - 1, 0);
        const previous = series[previousIndex];
        const current = series[lastIndex];
        const deltaPoints = roundTo2(current.qualityPercent - previous.qualityPercent);
        const growthPercent =
          previous.qualityPercent === 0
            ? current.qualityPercent === 0
              ? 0
              : 100
            : roundTo2((deltaPoints / previous.qualityPercent) * 100);

        return {
          serviceKey: serviceKeyFromLabel(serviceLabel),
          serviceLabel,
          series,
          growth: {
            fromMonth: previous.month,
            toMonth: current.month,
            growthPercent,
            deltaPoints,
          },
        };
      },
    );

    return {
      period,
      services,
    };
  }

  async getCurrentMonthByService(filters: {
    month?: string;
    module?: ModuleType;
    teamId?: string;
  }): Promise<CurrentMonthByServiceResponseDto> {
    const month = resolveMonthOrCurrent(filters.month);

    const serviceLabelExpr = `COALESCE(NULLIF(checklistSector.name, ''), NULLIF(serviceOrderSector.name, ''), NULLIF(inspection.serviceDescription, ''), 'SEM_SERVICO')`;
    const monthExpr = `to_char(timezone('${DASHBOARD_TIMEZONE}', COALESCE(inspection.finalizedAt, inspection.createdAt)), 'YYYY-MM')`;

    const summaryQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.checklist', 'checklist')
      .leftJoin('checklist.sector', 'checklistSector')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('serviceOrder.sector', 'serviceOrderSector')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere(`UPPER(TRIM(${serviceLabelExpr})) IN (:...allowedSectors)`, {
        allowedSectors: QUALITY_BY_SERVICE_ALLOWED_SECTORS,
      })
      .andWhere(`${monthExpr} = :month`, { month })
      .select('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingAdjustmentsCount',
      )
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE);

    this.applyQualityFilters(summaryQb, {
      module: filters.module,
      teamId: filters.teamId,
    });

    const rankingQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.checklist', 'checklist')
      .leftJoin('checklist.sector', 'checklistSector')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('serviceOrder.sector', 'serviceOrderSector')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere(`UPPER(TRIM(${serviceLabelExpr})) IN (:...allowedSectors)`, {
        allowedSectors: QUALITY_BY_SERVICE_ALLOWED_SECTORS,
      })
      .andWhere(`${monthExpr} = :month`, { month })
      .select(serviceLabelExpr, 'serviceLabel')
      .addSelect('AVG(inspection.scorePercent)', 'qualityPercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .groupBy(serviceLabelExpr)
      .orderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST')
      .addOrderBy(serviceLabelExpr, 'ASC');

    this.applyQualityFilters(rankingQb, {
      module: filters.module,
      teamId: filters.teamId,
    });

    const [summaryRow, rankingRows] = await Promise.all([
      summaryQb.getRawOne<{
        averagePercent: string | null;
        inspectionsCount: string;
        pendingAdjustmentsCount: string;
      }>(),
      rankingQb.getRawMany<{
        serviceLabel: string;
        qualityPercent: string | null;
        inspectionsCount: string;
      }>(),
    ]);

    return {
      month,
      summary: {
        averagePercent: roundTo2(parseFloat(summaryRow?.averagePercent ?? '0')),
        inspectionsCount: parseInt(summaryRow?.inspectionsCount ?? '0', 10),
        pendingAdjustmentsCount: parseInt(
          summaryRow?.pendingAdjustmentsCount ?? '0',
          10,
        ),
      },
      services: rankingRows.map((row) => ({
        serviceKey: serviceKeyFromLabel(row.serviceLabel),
        serviceLabel: row.serviceLabel,
        qualityPercent: roundTo2(parseFloat(row.qualityPercent ?? '0')),
        inspectionsCount: parseInt(row.inspectionsCount ?? '0', 10),
      })),
    };
  }
}
