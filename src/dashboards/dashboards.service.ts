import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { In, Repository } from 'typeorm';
import { Inspection, Team } from '../entities';
import {
  ModuleType,
  InspectionScope,
  InspectionStatus,
  ChecklistAnswer,
} from '../common/enums';
import {
  applyContractScopeFilter,
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';
import {
  CurrentMonthByServiceResponseDto,
  LowScoreCollaboratorsResponseDto,
  NonConformitiesByChecklistResponseDto,
  NonConformitiesByTeamResponseDto,
  QualityByServiceResponseDto,
  TeamRankingInspectionsResponseDto,
  TeamRankingMetric,
  TeamPerformanceByTeamsResponseDto,
} from './dto';

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
const DEFAULT_LOW_SCORE_THRESHOLD = 70;
const DEFAULT_LOW_SCORE_LIMIT = 15;
const MAX_LOW_SCORE_LIMIT = 100;
const DEFAULT_NON_CONFORMITIES_LIMIT_PER_CHECKLIST = 5;
const MAX_NON_CONFORMITIES_LIMIT_PER_CHECKLIST = 20;
const DEFAULT_NON_CONFORMITIES_LIMIT_BY_TEAM = 10;
const MAX_NON_CONFORMITIES_LIMIT_BY_TEAM = 20;
type DashboardSector = 'QUALITY' | 'SAFETY_WORK';
const QUALITY_FINALIZED_AT_PERIOD_MODULES = [
  ModuleType.POS_OBRA,
  ModuleType.OBRAS_INVESTIMENTO,
];
const QUALITY_DASHBOARD_MODULES = [
  ModuleType.CAMPO,
  ModuleType.POS_OBRA,
  ModuleType.REMOTO,
  ModuleType.OBRAS_INVESTIMENTO,
];
const SAFETY_WORK_DASHBOARD_MODULES = [ModuleType.SEGURANCA_TRABALHO];

/** Converte uma data YYYY-MM-DD para o fim do dia (23:59:59.999) em UTC. */
function toEndOfDay(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPreviousPeriod(
  from: string,
  to: string,
): { from: string; to: string } {
  const currentFrom = new Date(`${from}T00:00:00.000Z`);
  const currentTo = new Date(`${to}T00:00:00.000Z`);
  const inclusiveDays =
    Math.floor(
      (currentTo.getTime() - currentFrom.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;

  const previousTo = new Date(currentFrom);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);

  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - (inclusiveDays - 1));

  return {
    from: toDateOnlyString(previousFrom),
    to: toDateOnlyString(previousTo),
  };
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
  const [fromYear, fromMonth] = from
    .split('-')
    .map((value) => parseInt(value, 10));
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

  private parseTeamIdsCsv(teamIdsCsv: string): string[] {
    const teamIds = teamIdsCsv
      .split(',')
      .map((teamId) => teamId.trim())
      .filter(Boolean);

    if (teamIds.length === 0) {
      throw new BadRequestException('teamIds deve conter ao menos um id');
    }

    const hasInvalidTeamId = teamIds.some((teamId) => !isUUID(teamId, '4'));
    if (hasInvalidTeamId) {
      throw new BadRequestException(
        'teamIds deve conter apenas UUIDs válidos (v4)',
      );
    }

    return Array.from(new Set(teamIds));
  }

  private getSectorModules(sector?: DashboardSector): ModuleType[] | undefined {
    if (sector === 'QUALITY') {
      return QUALITY_DASHBOARD_MODULES;
    }
    if (sector === 'SAFETY_WORK') {
      return SAFETY_WORK_DASHBOARD_MODULES;
    }
    return undefined;
  }

  private resolvePeriodModule(
    module?: ModuleType,
    sector?: DashboardSector,
  ): ModuleType | undefined {
    if (module) {
      return module;
    }
    if (sector === 'SAFETY_WORK') {
      return ModuleType.SEGURANCA_TRABALHO;
    }
    return undefined;
  }

  private applyQualityFilters(
    qb: any,
    filters: {
      sector?: DashboardSector;
      module?: ModuleType;
      teamId?: string;
    },
  ): void {
    const sectorModules = this.getSectorModules(filters.sector);
    if (filters.module) {
      if (sectorModules && !sectorModules.includes(filters.module)) {
        throw new BadRequestException(
          `module inválido para o setor ${filters.sector}. Valores aceitos: ${sectorModules.join(', ')}`,
        );
      }
      qb.andWhere('inspection.module = :module', { module: filters.module });
    } else if (sectorModules) {
      qb.andWhere('inspection.module IN (:...dashboardSectorModules)', {
        dashboardSectorModules: sectorModules,
      });
    }
    if (filters.teamId) {
      qb.andWhere('inspection.teamId = :teamId', { teamId: filters.teamId });
    }
  }

  private applyContractScope(qb: any, user: any, contractId?: string): void {
    if (contractId) {
      qb.andWhere('inspection.contractId = :dashboardContractId', {
        dashboardContractId: contractId,
      });
    }
    const allowedContractIds = getAllowedContractIds(user);
    applyContractScopeFilter(qb, allowedContractIds, 'inspection.contractId');
  }

  private applyDashboardPeriodFilter(
    qb: any,
    filters: {
      from: string;
      to: Date;
      module?: ModuleType;
    },
  ): void {
    if (filters.module === ModuleType.SEGURANCA_TRABALHO) {
      qb.andWhere(
        'COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from',
        {
          from: filters.from,
        },
      );
      qb.andWhere(
        'COALESCE(inspection.finalizedAt, inspection.createdAt) <= :to',
        {
          to: filters.to,
        },
      );
      return;
    }

    if (filters.module) {
      qb.andWhere('serviceOrder.fim_execucao >= :from', { from: filters.from });
      qb.andWhere('serviceOrder.fim_execucao <= :to', { to: filters.to });
      return;
    }

    qb.andWhere(
      `(
        (
          inspection.module = :dashboardSafetyModulePeriod
          AND COALESCE(inspection.finalizedAt, inspection.createdAt) >= :from
          AND COALESCE(inspection.finalizedAt, inspection.createdAt) <= :to
        )
        OR
        (
          inspection.module != :dashboardSafetyModulePeriod
          AND serviceOrder.fim_execucao >= :from
          AND serviceOrder.fim_execucao <= :to
        )
      )`,
      {
        from: filters.from,
        to: filters.to,
        dashboardSafetyModulePeriod: ModuleType.SEGURANCA_TRABALHO,
      },
    );
  }

  private qualityPeriodTimestampExpr(): string {
    return `CASE WHEN inspection.module IN (:...dashboardFinalizedAtPeriodModules) THEN inspection.finalizedAt ELSE serviceOrder.fim_execucao END`;
  }

  private applyDashboardContractScope(
    qb: any,
    filters: {
      user?: any;
      contractId?: string;
      module?: ModuleType;
    },
  ): void {
    if (filters.contractId) {
      qb.andWhere('inspection.contractId = :dashboardContractId', {
        dashboardContractId: filters.contractId,
      });
    }

    const allowedContractIds = getAllowedContractIds(filters.user);
    applyContractScopeFilter(qb, allowedContractIds, 'inspection.contractId');
  }

  async getSummary(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    module?: ModuleType;
    teamId?: string;
    contractId?: string;
    includeQualityModuleCounts?: boolean;
  }) {
    this.validateDateRange(filters.from, filters.to);
    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingCount',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.module = :fieldModule THEN 1 ELSE 0 END)`,
        'fieldInspectionsCount',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :fieldModule THEN inspection.scorePercent ELSE NULL END)`,
        'fieldAveragePercent',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.module = :postWorkModule THEN 1 ELSE 0 END)`,
        'postWorkInspectionsCount',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :postWorkModule THEN inspection.scorePercent ELSE NULL END)`,
        'postWorkAveragePercent',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.module = :remoteModule THEN 1 ELSE 0 END)`,
        'remoteInspectionsCount',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :remoteModule THEN inspection.scorePercent ELSE NULL END)`,
        'remoteAveragePercent',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.module = :investmentWorksModule THEN 1 ELSE 0 END)`,
        'investmentWorksInspectionsCount',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :investmentWorksModule THEN inspection.scorePercent ELSE NULL END)`,
        'investmentWorksAveragePercent',
      )
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE)
      .setParameter('fieldModule', ModuleType.CAMPO)
      .setParameter('postWorkModule', ModuleType.POS_OBRA)
      .setParameter('remoteModule', ModuleType.REMOTO)
      .setParameter('investmentWorksModule', ModuleType.OBRAS_INVESTIMENTO);

    this.applyQualityFilters(qb, {
      sector: filters.sector,
      module: filters.module,
      teamId: filters.teamId,
    });

    const periodModule = this.resolvePeriodModule(filters.module, filters.sector);
    if (periodModule === ModuleType.SEGURANCA_TRABALHO) {
      const toLimit = toEndOfDay(filters.to);
      this.applyDashboardPeriodFilter(qb, {
        from: filters.from,
        to: toLimit,
        module: periodModule,
      });
    } else {
      const qualityPeriodExpr = this.qualityPeriodTimestampExpr();
      // For quality dashboards, compare by Sao Paulo local date to align with monthly views.
      qb.andWhere(
        `DATE(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr})) >= :fromDate`,
        { fromDate: filters.from },
      );
      qb.andWhere(
        `DATE(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr})) <= :toDate`,
        { toDate: filters.to },
      );
      qb.setParameter(
        'dashboardFinalizedAtPeriodModules',
        QUALITY_FINALIZED_AT_PERIOD_MODULES,
      );
    }
    this.applyDashboardContractScope(qb, {
      user: filters.user,
      contractId: filters.contractId,
      module: periodModule,
    });

    const row = await qb.getRawOne<{
      inspectionsCount: string;
      pendingCount: string;
      averagePercent: string | null;
      fieldInspectionsCount: string;
      fieldAveragePercent: string | null;
      postWorkInspectionsCount: string;
      postWorkAveragePercent: string | null;
      remoteInspectionsCount: string;
      remoteAveragePercent: string | null;
      investmentWorksInspectionsCount: string;
      investmentWorksAveragePercent: string | null;
    }>();

    const inspectionsCount = parseInt(row?.inspectionsCount ?? '0', 10);
    const pendingCount = parseInt(row?.pendingCount ?? '0', 10);
    const averagePercentRaw = row?.averagePercent;
    const averagePercent =
      averagePercentRaw != null
        ? Math.round(parseFloat(averagePercentRaw) * 100) / 100
        : 0;

    const summary = {
      averagePercent,
      inspectionsCount,
      pendingCount,
    } as {
      averagePercent: number;
      inspectionsCount: number;
      pendingCount: number;
      field?: {
        inspectionsCount: number;
        averagePercent: number;
      };
      postWork?: {
        inspectionsCount: number;
        averagePercent: number;
      };
      remote?: {
        inspectionsCount: number;
        averagePercent: number;
      };
      investmentWorks?: {
        inspectionsCount: number;
        averagePercent: number;
      };
    };

    if (filters.includeQualityModuleCounts) {
      summary.field = {
        inspectionsCount: parseInt(row?.fieldInspectionsCount ?? '0', 10),
        averagePercent: roundTo2(parseFloat(row?.fieldAveragePercent ?? '0')),
      };
      summary.postWork = {
        inspectionsCount: parseInt(row?.postWorkInspectionsCount ?? '0', 10),
        averagePercent: roundTo2(parseFloat(row?.postWorkAveragePercent ?? '0')),
      };
      summary.remote = {
        inspectionsCount: parseInt(row?.remoteInspectionsCount ?? '0', 10),
        averagePercent: roundTo2(parseFloat(row?.remoteAveragePercent ?? '0')),
      };
      summary.investmentWorks = {
        inspectionsCount: parseInt(
          row?.investmentWorksInspectionsCount ?? '0',
          10,
        ),
        averagePercent: roundTo2(
          parseFloat(row?.investmentWorksAveragePercent ?? '0'),
        ),
      };
    }

    return summary;
  }

  async getTeamsRanking(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    module?: ModuleType;
    contractId?: string;
  }) {
    this.validateDateRange(filters.from, filters.to);
    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.team', 'team')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('inspection.teamId', 'teamId')
      .addSelect('COALESCE(team.name, :noTeam)', 'teamName')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect(
        `AVG(CASE WHEN inspection.module = :postWorkModule THEN inspection.scorePercent ELSE NULL END)`,
        'postWorkPercent',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :remoteModule THEN inspection.scorePercent ELSE NULL END)`,
        'remotePercent',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :fieldModule THEN inspection.scorePercent ELSE NULL END)`,
        'fieldPercent',
      )
      .addSelect(
        `AVG(CASE WHEN inspection.module = :investmentWorksModule THEN inspection.scorePercent ELSE NULL END)`,
        'investmentWorksPercent',
      )
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingCount',
      )
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE)
      .setParameter('postWorkModule', ModuleType.POS_OBRA)
      .setParameter('remoteModule', ModuleType.REMOTO)
      .setParameter('fieldModule', ModuleType.CAMPO)
      .setParameter('investmentWorksModule', ModuleType.OBRAS_INVESTIMENTO)
      .setParameter('noTeam', 'Sem equipe')
      .groupBy('inspection.teamId')
      .addGroupBy('team.name')
      .orderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST');

    this.applyQualityFilters(qb, {
      sector: filters.sector,
      module: filters.module,
    });

    const periodModule = this.resolvePeriodModule(filters.module, filters.sector);
    if (periodModule === ModuleType.SEGURANCA_TRABALHO) {
      const toLimit = toEndOfDay(filters.to);
      this.applyDashboardPeriodFilter(qb, {
        from: filters.from,
        to: toLimit,
        module: periodModule,
      });
    } else {
      const qualityPeriodExpr = this.qualityPeriodTimestampExpr();
      qb.andWhere(
        `DATE(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr})) >= :fromDate`,
        { fromDate: filters.from },
      );
      qb.andWhere(
        `DATE(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr})) <= :toDate`,
        { toDate: filters.to },
      );
      qb.setParameter(
        'dashboardFinalizedAtPeriodModules',
        QUALITY_FINALIZED_AT_PERIOD_MODULES,
      );
    }
    this.applyDashboardContractScope(qb, {
      user: filters.user,
      contractId: filters.contractId,
      module: periodModule,
    });

    const rows = await qb.getRawMany<{
      teamId: string;
      teamName: string;
      inspectionsCount: string;
      averagePercent: string | null;
      postWorkPercent: string | null;
      remotePercent: string | null;
      fieldPercent: string | null;
      investmentWorksPercent: string | null;
      pendingCount: string;
    }>();

    return rows.map((row) => {
      const averagePercentRaw = row.averagePercent;
      const averagePercent =
        averagePercentRaw != null
          ? Math.round(parseFloat(averagePercentRaw) * 100) / 100
          : 0;
      const postWorkPercent = roundTo2(parseFloat(row.postWorkPercent ?? '0'));
      const remotePercent = roundTo2(parseFloat(row.remotePercent ?? '0'));
      const fieldPercent = roundTo2(parseFloat(row.fieldPercent ?? '0'));
      const investmentWorksPercent = roundTo2(
        parseFloat(row.investmentWorksPercent ?? '0'),
      );

      return {
        teamId: row.teamId,
        teamName: row.teamName,
        averagePercent,
        inspectionsCount: parseInt(row.inspectionsCount, 10),
        postWorkPercent,
        remotePercent,
        fieldPercent,
        investmentWorksPercent,
        pendingCount: parseInt(row.pendingCount, 10),
      };
    });
  }

  async getSafetyWorkTeamsRanking(filters: {
    user?: any;
    from: string;
    to: string;
    contractId?: string;
  }) {
    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.team', 'team')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('inspection.teamId', 'teamId')
      .addSelect('COALESCE(team.name, :noTeam)', 'teamName')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect(
        `AVG(CASE WHEN inspection.module = :safetyWorkModule THEN inspection.scorePercent ELSE NULL END)`,
        'safetyWorkPercent',
      )
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .setParameter('safetyWorkModule', ModuleType.SEGURANCA_TRABALHO)
      .setParameter('noTeam', 'Sem equipe')
      .groupBy('inspection.teamId')
      .addGroupBy('team.name')
      .orderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST');

    this.applyQualityFilters(qb, {
      sector: 'SAFETY_WORK',
    });

    const periodModule = this.resolvePeriodModule(undefined, 'SAFETY_WORK');
    this.applyDashboardPeriodFilter(qb, {
      from: filters.from,
      to: toLimit,
      module: periodModule,
    });
    this.applyDashboardContractScope(qb, {
      user: filters.user,
      contractId: filters.contractId,
      module: periodModule,
    });

    const rows = await qb.getRawMany<{
      teamId: string;
      teamName: string;
      inspectionsCount: string;
      averagePercent: string | null;
      safetyWorkPercent: string | null;
    }>();

    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      averagePercent: roundTo2(parseFloat(row.averagePercent ?? '0')),
      safetyWorkPercent: roundTo2(parseFloat(row.safetyWorkPercent ?? '0')),
      inspectionsCount: parseInt(row.inspectionsCount, 10),
    }));
  }

  async getTeamPerformance(
    teamId: string,
    filters: {
      user?: any;
      from: string;
      to: string;
      sector?: DashboardSector;
      module?: ModuleType;
      contractId?: string;
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
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
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
      .andWhere('serviceOrder.fim_execucao >= :from', { from: filters.from })
      .andWhere('serviceOrder.fim_execucao <= :to', { to: toLimit });

    this.applyQualityFilters(qb, {
      sector: filters.sector,
      module: filters.module,
    });
    this.applyContractScope(qb, filters.user, filters.contractId);

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

  async getTeamRankingInspections(
    teamId: string,
    filters: {
      user?: any;
      from: string;
      to: string;
      sector?: DashboardSector;
      metric?: TeamRankingMetric;
      page?: number;
      limit?: number;
      contractId?: string;
    },
  ): Promise<TeamRankingInspectionsResponseDto> {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Equipe não encontrada');
    }

    this.validateDateRange(filters.from, filters.to);
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const metric = filters.metric ?? TeamRankingMetric.AVERAGE;
    const qualityPeriodExpr = this.qualityPeriodTimestampExpr();
    const finishedAtExpr = `CASE WHEN inspection.module = :dashboardSafetyModuleFinishedAt THEN COALESCE(inspection.finalizedAt, inspection.createdAt) ELSE ${qualityPeriodExpr} END`;

    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('inspection.id', 'inspectionId')
      .addSelect('inspection.externalId', 'externalId')
      .addSelect('inspection.serviceOrderId', 'serviceOrderId')
      .addSelect('serviceOrder.osNumber', 'serviceOrderNumber')
      .addSelect('serviceOrder.address', 'serviceOrderAddress')
      .addSelect('inspection.locationDescription', 'locationDescription')
      .addSelect('inspection.module', 'module')
      .addSelect('inspection.status', 'status')
      .addSelect('inspection.scorePercent', 'scorePercent')
      .addSelect(finishedAtExpr, 'finishedAt')
      .addSelect('inspection.createdAt', 'createdAt')
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId = :teamId', { teamId })
      .andWhere('inspection.scorePercent IS NOT NULL')
      .setParameter(
        'dashboardSafetyModuleFinishedAt',
        ModuleType.SEGURANCA_TRABALHO,
      );

    const metricToModule = {
      [TeamRankingMetric.POST_WORK]: ModuleType.POS_OBRA,
      [TeamRankingMetric.REMOTE]: ModuleType.REMOTO,
      [TeamRankingMetric.FIELD]: ModuleType.CAMPO,
      [TeamRankingMetric.INVESTMENT_WORKS]: ModuleType.OBRAS_INVESTIMENTO,
      [TeamRankingMetric.SAFETY_WORK]: ModuleType.SEGURANCA_TRABALHO,
    };

    if (metric !== TeamRankingMetric.AVERAGE) {
      qb.andWhere('inspection.module = :module', {
        module: metricToModule[metric],
      });
    }

    const metricModule =
      metric !== TeamRankingMetric.AVERAGE ? metricToModule[metric] : undefined;

    this.applyQualityFilters(qb, {
      sector: filters.sector,
      module: metricModule,
    });
    qb.setParameter(
      'dashboardFinalizedAtPeriodModules',
      QUALITY_FINALIZED_AT_PERIOD_MODULES,
    );
    const periodModule = this.resolvePeriodModule(metricModule, filters.sector);
    if (periodModule === ModuleType.SEGURANCA_TRABALHO) {
      const toLimit = toEndOfDay(filters.to);
      this.applyDashboardPeriodFilter(qb, {
        from: filters.from,
        to: toLimit,
        module: periodModule,
      });
    } else {
      qb.andWhere(
        `DATE(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr})) >= :fromDate`,
        { fromDate: filters.from },
      );
      qb.andWhere(
        `DATE(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr})) <= :toDate`,
        { toDate: filters.to },
      );
    }
    this.applyDashboardContractScope(qb, {
      user: filters.user,
      contractId: filters.contractId,
      module: periodModule,
    });

    const [rows, total] = await Promise.all([
      qb
        .clone()
        .orderBy(finishedAtExpr, 'DESC', 'NULLS LAST')
        .addOrderBy('inspection.createdAt', 'DESC')
        .offset(skip)
        .limit(limit)
        .getRawMany<{
          inspectionId: string;
          externalId: string | null;
          serviceOrderId: string | null;
          serviceOrderNumber: string | null;
          serviceOrderAddress: string | null;
          locationDescription: string | null;
          module: ModuleType;
          status: InspectionStatus;
          scorePercent: string;
          finishedAt: Date | null;
          createdAt: Date;
        }>(),
      qb.clone().getCount(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      from: filters.from,
      to: filters.to,
      teamId: team.id,
      teamName: team.name,
      metric,
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      inspections: rows.map((row) => ({
        inspectionId: row.inspectionId,
        externalId: row.externalId,
        serviceOrderId: row.serviceOrderId,
        serviceOrderNumber: row.serviceOrderNumber,
        serviceOrderAddress: row.serviceOrderAddress ?? row.locationDescription,
        module: row.module,
        status: row.status,
        scorePercent: roundTo2(parseFloat(row.scorePercent ?? '0')),
        finishedAt: row.finishedAt,
        createdAt: row.createdAt,
      })),
    };
  }

  async getQualityByService(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    module?: ModuleType;
    teamId?: string;
    contractId?: string;
  }): Promise<QualityByServiceResponseDto> {
    this.validateDateRange(filters.from, filters.to);

    const monthExpr = `to_char(timezone('${DASHBOARD_TIMEZONE}', serviceOrder.fim_execucao), 'YYYY-MM')`;
    const serviceLabelExpr = `COALESCE(NULLIF(checklistSector.name, ''), NULLIF(serviceOrderSector.name, ''), NULLIF(inspection.serviceDescription, ''), 'SEM_SERVICO')`;
    const dayExpr = `DATE(timezone('${DASHBOARD_TIMEZONE}', serviceOrder.fim_execucao))`;

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
      sector: filters.sector,
      module: filters.module,
      teamId: filters.teamId,
    });
    this.applyDashboardContractScope(qb, {
      user: filters.user,
      contractId: filters.contractId,
      module: filters.module,
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
          row.qualityPercent != null
            ? roundTo2(parseFloat(row.qualityPercent))
            : 0,
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
        const deltaPoints = roundTo2(
          current.qualityPercent - previous.qualityPercent,
        );
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
    user?: any;
    month?: string;
    sector?: DashboardSector;
    module?: ModuleType;
    teamId?: string;
    contractId?: string;
  }): Promise<CurrentMonthByServiceResponseDto> {
    const month = resolveMonthOrCurrent(filters.month);
    const periodModule = this.resolvePeriodModule(filters.module, filters.sector);

    const serviceLabelExpr = `COALESCE(NULLIF(checklistSector.name, ''), NULLIF(serviceOrderSector.name, ''), NULLIF(inspection.serviceDescription, ''), 'SEM_SERVICO')`;
    const qualityPeriodExpr = this.qualityPeriodTimestampExpr();
    const monthExpr =
      periodModule === ModuleType.SEGURANCA_TRABALHO
        ? `to_char(timezone('${DASHBOARD_TIMEZONE}', COALESCE(inspection.finalizedAt, inspection.createdAt)), 'YYYY-MM')`
        : `to_char(timezone('${DASHBOARD_TIMEZONE}', ${qualityPeriodExpr}), 'YYYY-MM')`;

    const summaryQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.checklist', 'checklist')
      .leftJoin('checklist.sector', 'checklistSector')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('serviceOrder.sector', 'serviceOrderSector')
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .andWhere(`${monthExpr} = :month`, { month })
      .select('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingAdjustmentsCount',
      )
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE);

    this.applyQualityFilters(summaryQb, {
      sector: filters.sector,
      module: filters.module,
      teamId: filters.teamId,
    });
    summaryQb.setParameter(
      'dashboardFinalizedAtPeriodModules',
      QUALITY_FINALIZED_AT_PERIOD_MODULES,
    );
    this.applyContractScope(summaryQb, filters.user, filters.contractId);

    const rankingQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.checklist', 'checklist')
      .leftJoin('checklist.sector', 'checklistSector')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('serviceOrder.sector', 'serviceOrderSector')
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.teamId IS NOT NULL')
      .andWhere(`${monthExpr} = :month`, { month })
      .select(serviceLabelExpr, 'serviceLabel')
      .addSelect('AVG(inspection.scorePercent)', 'qualityPercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .groupBy(serviceLabelExpr)
      .orderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST')
      .addOrderBy(serviceLabelExpr, 'ASC');

    this.applyQualityFilters(rankingQb, {
      sector: filters.sector,
      module: filters.module,
      teamId: filters.teamId,
    });
    rankingQb.setParameter(
      'dashboardFinalizedAtPeriodModules',
      QUALITY_FINALIZED_AT_PERIOD_MODULES,
    );
    this.applyContractScope(rankingQb, filters.user, filters.contractId);

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

  async getTeamPerformanceByTeams(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    teamIdsCsv: string;
    contractId?: string;
  }): Promise<TeamPerformanceByTeamsResponseDto> {
    this.validateDateRange(filters.from, filters.to);
    const teamIds = this.parseTeamIdsCsv(filters.teamIdsCsv);
    const previousPeriod = getPreviousPeriod(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const previousToLimit = toEndOfDay(previousPeriod.to);

    const teams = await this.teamRepository.find({
      where: { id: In(teamIds) },
      select: ['id', 'name'],
    });
    const teamsById = new Map(teams.map((team) => [team.id, team]));
    const missingTeamIds = teamIds.filter((teamId) => !teamsById.has(teamId));
    if (missingTeamIds.length > 0) {
      throw new BadRequestException(
        `Equipe(s) não encontrada(s): ${missingTeamIds.join(', ')}`,
      );
    }

    const currentSummaryQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingAdjustmentsCount',
      )
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere('inspection.teamId IN (:...teamIds)', { teamIds })
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit })
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE);

    const previousSummaryQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('AVG(inspection.scorePercent)', 'averagePercent')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere('inspection.teamId IN (:...teamIds)', { teamIds })
      .andWhere('inspection.createdAt >= :from', { from: previousPeriod.from })
      .andWhere('inspection.createdAt <= :to', { to: previousToLimit });

    const teamRankingQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .innerJoin('inspection.team', 'team')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('inspection.teamId', 'teamId')
      .addSelect('team.name', 'teamName')
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(
        `SUM(CASE WHEN inspection.status = :pendingStatus THEN 1 ELSE 0 END)`,
        'pendingAdjustmentsCount',
      )
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere('inspection.teamId IN (:...teamIds)', { teamIds })
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit })
      .groupBy('inspection.teamId')
      .addGroupBy('team.name')
      .orderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST')
      .addOrderBy('team.name', 'ASC')
      .setParameter('pendingStatus', InspectionStatus.PENDENTE_AJUSTE);

    const collaboratorsQb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .innerJoin('inspection.collaborators', 'collaborator')
      .innerJoin('inspection.team', 'team')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('inspection.teamId', 'teamId')
      .addSelect('collaborator.id', 'collaboratorId')
      .addSelect('collaborator.name', 'collaboratorName')
      .addSelect('AVG(inspection.scorePercent)', 'qualityPercent')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere('inspection.teamId IN (:...teamIds)', { teamIds })
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit })
      .groupBy('inspection.teamId')
      .addGroupBy('collaborator.id')
      .addGroupBy('collaborator.name')
      .orderBy('inspection.teamId', 'ASC')
      .addOrderBy('AVG(inspection.scorePercent)', 'DESC', 'NULLS LAST')
      .addOrderBy('collaborator.name', 'ASC');

    this.applyQualityFilters(currentSummaryQb, { sector: filters.sector });
    this.applyQualityFilters(previousSummaryQb, { sector: filters.sector });
    this.applyQualityFilters(teamRankingQb, { sector: filters.sector });
    this.applyQualityFilters(collaboratorsQb, { sector: filters.sector });
    this.applyContractScope(currentSummaryQb, filters.user, filters.contractId);
    this.applyContractScope(
      previousSummaryQb,
      filters.user,
      filters.contractId,
    );
    this.applyContractScope(teamRankingQb, filters.user, filters.contractId);
    this.applyContractScope(collaboratorsQb, filters.user, filters.contractId);

    const [currentSummaryRow, previousSummaryRow, teamRows, collaboratorRows] =
      await Promise.all([
        currentSummaryQb.getRawOne<{
          averagePercent: string | null;
          inspectionsCount: string;
          pendingAdjustmentsCount: string;
        }>(),
        previousSummaryQb.getRawOne<{ averagePercent: string | null }>(),
        teamRankingQb.getRawMany<{
          teamId: string;
          teamName: string;
          averagePercent: string | null;
          inspectionsCount: string;
          pendingAdjustmentsCount: string;
        }>(),
        collaboratorsQb.getRawMany<{
          teamId: string;
          collaboratorId: string;
          collaboratorName: string;
          qualityPercent: string | null;
          inspectionsCount: string;
        }>(),
      ]);

    const collaboratorsByTeam = new Map<
      string,
      {
        collaboratorId: string;
        collaboratorName: string;
        qualityPercent: number;
        inspectionsCount: number;
      }[]
    >();

    for (const row of collaboratorRows) {
      if (!collaboratorsByTeam.has(row.teamId)) {
        collaboratorsByTeam.set(row.teamId, []);
      }
      collaboratorsByTeam.get(row.teamId)!.push({
        collaboratorId: row.collaboratorId,
        collaboratorName: row.collaboratorName,
        qualityPercent: roundTo2(parseFloat(row.qualityPercent ?? '0')),
        inspectionsCount: parseInt(row.inspectionsCount ?? '0', 10),
      });
    }

    const teamStatsById = new Map(teamRows.map((row) => [row.teamId, row]));
    const teamsResult = teamIds.map((teamId) => {
      const team = teamsById.get(teamId)!;
      const teamStats = teamStatsById.get(teamId);

      return {
        teamId,
        teamName: team.name,
        averagePercent: roundTo2(parseFloat(teamStats?.averagePercent ?? '0')),
        inspectionsCount: parseInt(teamStats?.inspectionsCount ?? '0', 10),
        pendingAdjustmentsCount: parseInt(
          teamStats?.pendingAdjustmentsCount ?? '0',
          10,
        ),
        collaborators: collaboratorsByTeam.get(teamId) ?? [],
      };
    });

    return {
      from: filters.from,
      to: filters.to,
      teamIds,
      summary: {
        averagePercent: roundTo2(
          parseFloat(currentSummaryRow?.averagePercent ?? '0'),
        ),
        previousAveragePercent: roundTo2(
          parseFloat(previousSummaryRow?.averagePercent ?? '0'),
        ),
        inspectionsCount: parseInt(
          currentSummaryRow?.inspectionsCount ?? '0',
          10,
        ),
        pendingAdjustmentsCount: parseInt(
          currentSummaryRow?.pendingAdjustmentsCount ?? '0',
          10,
        ),
      },
      teams: teamsResult,
    };
  }

  async getLowScoreCollaborators(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    lowScoreThreshold?: number;
    limit?: number;
    contractId?: string;
  }): Promise<LowScoreCollaboratorsResponseDto> {
    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const lowScoreThreshold = roundTo2(
      filters.lowScoreThreshold ?? DEFAULT_LOW_SCORE_THRESHOLD,
    );
    const limit = Math.min(
      Math.max(filters.limit ?? DEFAULT_LOW_SCORE_LIMIT, 1),
      MAX_LOW_SCORE_LIMIT,
    );
    const lowScoreCountExpr =
      'SUM(CASE WHEN inspection.scorePercent < :lowScoreThreshold THEN 1 ELSE 0 END)';

    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .innerJoin('inspection.collaborators', 'collaborator')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('collaborator.id', 'collaboratorId')
      .addSelect('collaborator.name', 'collaboratorName')
      .addSelect('COUNT(inspection.id)', 'inspectionsCount')
      .addSelect(lowScoreCountExpr, 'badScoresCount')
      .addSelect('AVG(inspection.scorePercent)', 'averagePercent')
      .addSelect('MIN(inspection.scorePercent)', 'worstScorePercent')
      .addSelect('MAX(inspection.scorePercent)', 'bestScorePercent')
      .where('inspection.status != :draft', {
        draft: InspectionStatus.RASCUNHO,
      })
      .andWhere('inspection.module = :module', {
        module: ModuleType.SEGURANCA_TRABALHO,
      })
      .andWhere('inspection.inspectionScope = :inspectionScope', {
        inspectionScope: InspectionScope.COLLABORATOR,
      })
      .andWhere('inspection.scorePercent IS NOT NULL')
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit })
      .groupBy('collaborator.id')
      .addGroupBy('collaborator.name')
      .setParameter('lowScoreThreshold', lowScoreThreshold)
      .orderBy(lowScoreCountExpr, 'DESC')
      .addOrderBy('AVG(inspection.scorePercent)', 'ASC', 'NULLS LAST')
      .addOrderBy('COUNT(inspection.id)', 'DESC')
      .limit(limit);

    this.applyQualityFilters(qb, { sector: 'SAFETY_WORK' });
    this.applyContractScope(qb, filters.user, filters.contractId);

    const rows = await qb.getRawMany<{
      collaboratorId: string;
      collaboratorName: string;
      inspectionsCount: string;
      badScoresCount: string;
      averagePercent: string | null;
      worstScorePercent: string | null;
      bestScorePercent: string | null;
    }>();

    return {
      from: filters.from,
      to: filters.to,
      lowScoreThreshold,
      collaborators: rows.map((row) => {
        const inspectionsCount = parseInt(row.inspectionsCount ?? '0', 10);
        const badScoresCount = parseInt(row.badScoresCount ?? '0', 10);
        const badScoreRatePercent =
          inspectionsCount > 0
            ? roundTo2((badScoresCount / inspectionsCount) * 100)
            : 0;

        return {
          collaboratorId: row.collaboratorId,
          collaboratorName: row.collaboratorName,
          inspectionsCount,
          badScoresCount,
          badScoreRatePercent,
          averagePercent: roundTo2(parseFloat(row.averagePercent ?? '0')),
          worstScorePercent: roundTo2(parseFloat(row.worstScorePercent ?? '0')),
          bestScorePercent: roundTo2(parseFloat(row.bestScorePercent ?? '0')),
        };
      }),
    };
  }

  async getTopNonConformitiesByChecklist(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    module?: ModuleType;
    teamId?: string;
    limitPerChecklist?: number;
    contractId?: string;
  }): Promise<NonConformitiesByChecklistResponseDto> {
    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const limitPerChecklist = Math.min(
      Math.max(
        filters.limitPerChecklist ??
          DEFAULT_NON_CONFORMITIES_LIMIT_PER_CHECKLIST,
        1,
      ),
      MAX_NON_CONFORMITIES_LIMIT_PER_CHECKLIST,
    );

    const nonConformCountExpr = `SUM(CASE WHEN inspectionItem.answer = :nonConformAnswer THEN 1 ELSE 0 END)`;
    const answersCountExpr = `SUM(CASE WHEN inspectionItem.answer IS NOT NULL THEN 1 ELSE 0 END)`;

    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .innerJoin('inspection.items', 'inspectionItem')
      .innerJoin('inspection.checklist', 'checklist')
      .innerJoin('inspectionItem.checklistItem', 'checklistItem')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('checklist.id', 'checklistId')
      .addSelect('checklist.name', 'checklistName')
      .addSelect('checklistItem.id', 'checklistItemId')
      .addSelect('checklistItem.title', 'checklistItemTitle')
      .addSelect(nonConformCountExpr, 'nonConformitiesCount')
      .addSelect(answersCountExpr, 'answersCount')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit })
      .setParameter('nonConformAnswer', ChecklistAnswer.NAO_CONFORME)
      .groupBy('checklist.id')
      .addGroupBy('checklist.name')
      .addGroupBy('checklistItem.id')
      .addGroupBy('checklistItem.title')
      .having(`${nonConformCountExpr} > 0`)
      .orderBy(nonConformCountExpr, 'DESC')
      .addOrderBy('checklist.name', 'ASC')
      .addOrderBy('checklistItem.title', 'ASC');

    this.applyQualityFilters(qb, {
      sector: filters.sector,
      module: filters.module,
      teamId: filters.teamId,
    });
    const periodModule = this.resolvePeriodModule(filters.module, filters.sector);
    this.applyDashboardContractScope(qb, {
      user: filters.user,
      contractId: filters.contractId,
      module: periodModule,
    });

    const rows = await qb.getRawMany<{
      checklistId: string;
      checklistName: string;
      checklistItemId: string;
      checklistItemTitle: string;
      nonConformitiesCount: string;
      answersCount: string;
    }>();

    const checklistsMap = new Map<
      string,
      {
        checklistId: string;
        checklistName: string;
        totalNonConformities: number;
        questions: Array<{
          checklistItemId: string;
          checklistItemTitle: string;
          nonConformitiesCount: number;
          answersCount: number;
          nonConformityRatePercent: number;
        }>;
      }
    >();

    for (const row of rows) {
      const checklistId = row.checklistId;
      const nonConformitiesCount = parseInt(
        row.nonConformitiesCount ?? '0',
        10,
      );
      const answersCount = parseInt(row.answersCount ?? '0', 10);
      const nonConformityRatePercent =
        answersCount > 0
          ? roundTo2((nonConformitiesCount / answersCount) * 100)
          : 0;

      if (!checklistsMap.has(checklistId)) {
        checklistsMap.set(checklistId, {
          checklistId,
          checklistName: row.checklistName,
          totalNonConformities: 0,
          questions: [],
        });
      }

      const checklistEntry = checklistsMap.get(checklistId)!;
      checklistEntry.totalNonConformities += nonConformitiesCount;
      checklistEntry.questions.push({
        checklistItemId: row.checklistItemId,
        checklistItemTitle: row.checklistItemTitle,
        nonConformitiesCount,
        answersCount,
        nonConformityRatePercent,
      });
    }

    const checklists = Array.from(checklistsMap.values())
      .map((checklistEntry) => ({
        ...checklistEntry,
        questions: checklistEntry.questions
          .sort((a, b) => {
            if (b.nonConformitiesCount !== a.nonConformitiesCount) {
              return b.nonConformitiesCount - a.nonConformitiesCount;
            }

            return a.checklistItemTitle.localeCompare(b.checklistItemTitle);
          })
          .slice(0, limitPerChecklist),
      }))
      .sort((a, b) => {
        if (b.totalNonConformities !== a.totalNonConformities) {
          return b.totalNonConformities - a.totalNonConformities;
        }

        return a.checklistName.localeCompare(b.checklistName);
      });

    return {
      from: filters.from,
      to: filters.to,
      module: filters.module,
      teamId: filters.teamId,
      limitPerChecklist,
      checklists,
    };
  }

  async getTopNonConformitiesByTeam(filters: {
    user?: any;
    from: string;
    to: string;
    sector?: DashboardSector;
    module?: ModuleType;
    teamId: string;
    limit?: number;
    contractId?: string;
  }): Promise<NonConformitiesByTeamResponseDto> {
    this.validateDateRange(filters.from, filters.to);
    const toLimit = toEndOfDay(filters.to);
    const limit = Math.min(
      Math.max(filters.limit ?? DEFAULT_NON_CONFORMITIES_LIMIT_BY_TEAM, 1),
      MAX_NON_CONFORMITIES_LIMIT_BY_TEAM,
    );

    const nonConformCountExpr = `SUM(CASE WHEN inspectionItem.answer = :nonConformAnswer THEN 1 ELSE 0 END)`;
    const answersCountExpr = `SUM(CASE WHEN inspectionItem.answer IS NOT NULL THEN 1 ELSE 0 END)`;

    const qb = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .innerJoin('inspection.items', 'inspectionItem')
      .innerJoin('inspectionItem.checklistItem', 'checklistItem')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .select('checklistItem.id', 'checklistItemId')
      .addSelect('checklistItem.title', 'checklistItemTitle')
      .addSelect(nonConformCountExpr, 'nonConformitiesCount')
      .addSelect(answersCountExpr, 'answersCount')
      .addSelect('COUNT(DISTINCT inspection.checklistId)', 'checklistsCount')
      .where('inspection.status IN (:...qualityStatuses)', {
        qualityStatuses: QUALITY_RELEVANT_STATUSES,
      })
      .andWhere('inspection.teamId = :teamId', { teamId: filters.teamId })
      .andWhere('inspection.createdAt >= :from', { from: filters.from })
      .andWhere('inspection.createdAt <= :to', { to: toLimit })
      .setParameter('nonConformAnswer', ChecklistAnswer.NAO_CONFORME)
      .groupBy('checklistItem.id')
      .addGroupBy('checklistItem.title')
      .having(`${nonConformCountExpr} > 0`)
      .orderBy(nonConformCountExpr, 'DESC')
      .addOrderBy('checklistItem.title', 'ASC')
      .limit(limit);

    this.applyQualityFilters(qb, {
      sector: filters.sector,
      module: filters.module,
    });
    this.applyContractScope(qb, filters.user, filters.contractId);

    const rows = await qb.getRawMany<{
      checklistItemId: string;
      checklistItemTitle: string;
      nonConformitiesCount: string;
      answersCount: string;
      checklistsCount: string;
    }>();

    return {
      from: filters.from,
      to: filters.to,
      module: filters.module,
      teamId: filters.teamId,
      limit,
      nonConformities: rows.map((row) => {
        const nonConformitiesCount = parseInt(row.nonConformitiesCount ?? '0', 10);
        const answersCount = parseInt(row.answersCount ?? '0', 10);
        const checklistsCount = parseInt(row.checklistsCount ?? '0', 10);
        const nonConformityRatePercent =
          answersCount > 0
            ? roundTo2((nonConformitiesCount / answersCount) * 100)
            : 0;

        return {
          checklistItemId: row.checklistItemId,
          checklistItemTitle: row.checklistItemTitle,
          nonConformitiesCount,
          answersCount,
          nonConformityRatePercent,
          checklistsCount,
        };
      }),
    };
  }
}
