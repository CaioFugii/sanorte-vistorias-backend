import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection, Team } from '../entities';
import { ModuleType, InspectionStatus } from '../common/enums';

const MAX_DATE_RANGE_YEARS = 2;

/** Converte uma data YYYY-MM-DD para o fim do dia (23:59:59.999) em UTC. */
function toEndOfDay(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  d.setUTCHours(23, 59, 59, 999);
  return d;
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
}
