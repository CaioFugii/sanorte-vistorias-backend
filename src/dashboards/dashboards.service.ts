import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection, Team } from '../entities';
import { ModuleType, InspectionStatus } from '../common/enums';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Inspection)
    private inspectionsRepository: Repository<Inspection>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
  ) {}

  async getSummary(filters: {
    from?: string;
    to?: string;
    module?: ModuleType;
    teamId?: string;
  }) {
    const query = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .where('inspection.status != :draft', { draft: InspectionStatus.RASCUNHO });

    if (filters.from) {
      query.andWhere('inspection.createdAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('inspection.createdAt <= :to', { to: filters.to });
    }
    if (filters.module) {
      query.andWhere('inspection.module = :module', { module: filters.module });
    }
    if (filters.teamId) {
      query.andWhere('inspection.teamId = :teamId', { teamId: filters.teamId });
    }

    const inspections = await query.getMany();

    const totalInspections = inspections.length;
    const pendingCount = inspections.filter(
      (i) => i.status === InspectionStatus.PENDENTE_AJUSTE,
    ).length;

    const scores = inspections
      .map((i) => i.scorePercent)
      .filter((s) => s !== null && s !== undefined) as number[];

    const averagePercent =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + Number(score), 0) / scores.length
        : 0;

    return {
      averagePercent: Math.round(averagePercent * 100) / 100,
      inspectionsCount: totalInspections,
      pendingCount,
    };
  }

  async getTeamsRanking(filters: {
    from?: string;
    to?: string;
    module?: ModuleType;
  }) {
    const query = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoinAndSelect('inspection.team', 'team')
      .where('inspection.status != :draft', { draft: InspectionStatus.RASCUNHO });

    if (filters.from) {
      query.andWhere('inspection.createdAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('inspection.createdAt <= :to', { to: filters.to });
    }
    if (filters.module) {
      query.andWhere('inspection.module = :module', { module: filters.module });
    }

    const inspections = await query.getMany();

    // Agrupar por equipe
    const teamMap = new Map<string, any>();

    inspections.forEach((inspection) => {
      const teamId = inspection.teamId;
      if (!teamMap.has(teamId)) {
        teamMap.set(teamId, {
          teamId,
          teamName: inspection.team?.name || 'Sem equipe',
          scores: [],
          inspections: [],
        });
      }

      const teamData = teamMap.get(teamId);
      teamData.inspections.push(inspection);
      if (inspection.scorePercent !== null && inspection.scorePercent !== undefined) {
        teamData.scores.push(Number(inspection.scorePercent));
      }
    });

    // Calcular médias e contagens
    const ranking = Array.from(teamMap.values()).map((team) => {
      const averagePercent =
        team.scores.length > 0
          ? team.scores.reduce((sum: number, score: number) => sum + score, 0) /
            team.scores.length
          : 0;

      const pendingCount = team.inspections.filter(
        (i) => i.status === InspectionStatus.PENDENTE_AJUSTE,
      ).length;

      const paralyzedCount = team.inspections.filter(
        (i) => i.hasParalysisPenalty === true,
      ).length;
      const paralysisRatePercent =
        team.inspections.length > 0
          ? Math.round((paralyzedCount / team.inspections.length) * 10000) / 100
          : 0;

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        averagePercent: Math.round(averagePercent * 100) / 100,
        inspectionsCount: team.inspections.length,
        pendingCount,
        paralyzedCount,
        paralysisRatePercent,
      };
    });

    // Ordenar por média decrescente
    ranking.sort((a, b) => b.averagePercent - a.averagePercent);

    return ranking;
  }

  async getTeamPerformance(
    teamId: string,
    filters: {
      from?: string;
      to?: string;
      module?: ModuleType;
    },
  ) {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Equipe não encontrada');
    }

    const query = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .where('inspection.status != :draft', { draft: InspectionStatus.RASCUNHO })
      .andWhere('inspection.teamId = :teamId', { teamId });

    if (filters.from) {
      query.andWhere('inspection.createdAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('inspection.createdAt <= :to', { to: filters.to });
    }
    if (filters.module) {
      query.andWhere('inspection.module = :module', { module: filters.module });
    }

    const inspections = await query.getMany();

    const pendingCount = inspections.filter(
      (i) => i.status === InspectionStatus.PENDENTE_AJUSTE,
    ).length;

    const scores = inspections
      .map((i) => i.scorePercent)
      .filter((s) => s !== null && s !== undefined) as number[];
    const averagePercent =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + Number(score), 0) / scores.length
        : 0;

    const paralyzedCount = inspections.filter(
      (i) => i.hasParalysisPenalty === true,
    ).length;
    const paralysisRatePercent =
      inspections.length > 0
        ? Math.round((paralyzedCount / inspections.length) * 10000) / 100
        : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      averagePercent: Math.round(averagePercent * 100) / 100,
      inspectionsCount: inspections.length,
      pendingCount,
      paralyzedCount,
      paralysisRatePercent,
    };
  }
}
