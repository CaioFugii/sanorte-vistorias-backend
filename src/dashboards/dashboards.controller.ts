import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import {
  CurrentMonthByServiceQueryDto,
  DashboardQueryDto,
  LowScoreCollaboratorsQueryDto,
  NonConformitiesByChecklistQueryDto,
  NonConformitiesByTeamQueryDto,
  QualityByServiceQueryDto,
  TeamRankingInspectionsQueryDto,
  TeamPerformanceByTeamsQueryDto,
} from './dto';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  private summaryFilters(
    user: any,
    query: DashboardQueryDto,
    sector?: any,
    includeQualityModuleCounts?: boolean,
  ) {
    return {
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
      contractId: query.contractId,
      sector,
      includeQualityModuleCounts,
    };
  }

  private teamRankingFilters(
    user: any,
    query: TeamRankingInspectionsQueryDto,
    sector?: any,
  ) {
    return {
      user,
      from: query.from,
      to: query.to,
      metric: query.metric,
      page: query.page,
      limit: query.limit,
      contractId: query.contractId,
      sector,
    };
  }

  private qualityByServiceFilters(
    user: any,
    query: QualityByServiceQueryDto,
    sector?: any,
  ) {
    return {
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
      contractId: query.contractId,
      sector,
    };
  }

  private currentMonthByServiceFilters(
    user: any,
    query: CurrentMonthByServiceQueryDto,
    sector?: any,
  ) {
    return {
      user,
      month: query.month,
      module: query.module,
      teamId: query.teamId,
      contractId: query.contractId,
      sector,
    };
  }

  private performanceByTeamsFilters(
    user: any,
    query: TeamPerformanceByTeamsQueryDto,
    sector?: any,
  ) {
    return {
      user,
      from: query.from,
      to: query.to,
      teamIdsCsv: query.teamIds,
      contractId: query.contractId,
      sector,
    };
  }

  private nonConformitiesByChecklistFilters(
    user: any,
    query: NonConformitiesByChecklistQueryDto,
    sector?: any,
  ) {
    return {
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
      limitPerChecklist: query.limitPerChecklist,
      contractId: query.contractId,
      sector,
    };
  }

  private nonConformitiesByTeamFilters(
    user: any,
    query: NonConformitiesByTeamQueryDto,
    sector?: any,
  ) {
    return {
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
      limit: query.limit,
      contractId: query.contractId,
      sector,
    };
  }

  @Get('summary')
  getSummary(@CurrentUser() user: any, @Query() query: DashboardQueryDto) {
    return this.dashboardsService.getSummary(
      this.summaryFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/summary')
  getQualitySummary(@CurrentUser() user: any, @Query() query: DashboardQueryDto) {
    return this.dashboardsService.getSummary(
      this.summaryFilters(user, query, 'QUALITY', true),
    );
  }

  @Get('safety-work/summary')
  getSafetyWorkSummary(
    @CurrentUser() user: any,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getSummary(
      this.summaryFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('ranking/teams')
  getTeamsRanking(@CurrentUser() user: any, @Query() query: DashboardQueryDto) {
    return this.dashboardsService.getTeamsRanking(
      this.summaryFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/ranking/teams')
  getQualityTeamsRanking(
    @CurrentUser() user: any,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getTeamsRanking(
      this.summaryFilters(user, query, 'QUALITY'),
    );
  }

  @Get('ranking/teams/safety-work')
  getTeamsRankingSafetyWork(
    @CurrentUser() user: any,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getSafetyWorkTeamsRanking(
      this.summaryFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('ranking/teams/:teamId/inspections')
  getTeamRankingInspections(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: TeamRankingInspectionsQueryDto,
  ) {
    return this.dashboardsService.getTeamRankingInspections(
      teamId,
      this.teamRankingFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/ranking/teams/:teamId/inspections')
  getQualityTeamRankingInspections(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: TeamRankingInspectionsQueryDto,
  ) {
    return this.dashboardsService.getTeamRankingInspections(
      teamId,
      this.teamRankingFilters(user, query, 'QUALITY'),
    );
  }

  @Get('safety-work/ranking/teams/:teamId/inspections')
  getSafetyWorkTeamRankingInspections(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: TeamRankingInspectionsQueryDto,
  ) {
    return this.dashboardsService.getTeamRankingInspections(
      teamId,
      this.teamRankingFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('teams/:teamId')
  getTeamPerformance(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformance(teamId, {
      ...this.summaryFilters(user, query, 'QUALITY'),
    });
  }

  @Get('quality/teams/:teamId')
  getQualityTeamPerformance(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformance(teamId, {
      ...this.summaryFilters(user, query, 'QUALITY'),
    });
  }

  @Get('safety-work/teams/:teamId')
  getSafetyWorkTeamPerformance(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformance(teamId, {
      ...this.summaryFilters(user, query, 'SAFETY_WORK'),
    });
  }

  @Get('quality-by-service')
  getQualityByService(
    @CurrentUser() user: any,
    @Query() query: QualityByServiceQueryDto,
  ) {
    return this.dashboardsService.getQualityByService(
      this.qualityByServiceFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/quality-by-service')
  getQualitySectorByService(
    @CurrentUser() user: any,
    @Query() query: QualityByServiceQueryDto,
  ) {
    return this.dashboardsService.getQualityByService(
      this.qualityByServiceFilters(user, query, 'QUALITY'),
    );
  }

  @Get('safety-work/quality-by-service')
  getSafetyWorkByService(
    @CurrentUser() user: any,
    @Query() query: QualityByServiceQueryDto,
  ) {
    return this.dashboardsService.getQualityByService(
      this.qualityByServiceFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('current-month-by-service')
  getCurrentMonthByService(
    @CurrentUser() user: any,
    @Query() query: CurrentMonthByServiceQueryDto,
  ) {
    return this.dashboardsService.getCurrentMonthByService(
      this.currentMonthByServiceFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/current-month-by-service')
  getQualityCurrentMonthByService(
    @CurrentUser() user: any,
    @Query() query: CurrentMonthByServiceQueryDto,
  ) {
    return this.dashboardsService.getCurrentMonthByService(
      this.currentMonthByServiceFilters(user, query, 'QUALITY'),
    );
  }

  @Get('safety-work/current-month-by-service')
  getSafetyWorkCurrentMonthByService(
    @CurrentUser() user: any,
    @Query() query: CurrentMonthByServiceQueryDto,
  ) {
    return this.dashboardsService.getCurrentMonthByService(
      this.currentMonthByServiceFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('safety-work/low-score-collaborators')
  getLowScoreCollaborators(
    @CurrentUser() user: any,
    @Query() query: LowScoreCollaboratorsQueryDto,
  ) {
    return this.dashboardsService.getLowScoreCollaborators({
      user,
      from: query.from,
      to: query.to,
      lowScoreThreshold: query.lowScoreThreshold,
      limit: query.limit,
      contractId: query.contractId,
      sector: 'SAFETY_WORK',
    });
  }

  @Get('team-performance-by-teams')
  getTeamPerformanceByTeams(
    @CurrentUser() user: any,
    @Query() query: TeamPerformanceByTeamsQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformanceByTeams(
      this.performanceByTeamsFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/team-performance-by-teams')
  getQualityTeamPerformanceByTeams(
    @CurrentUser() user: any,
    @Query() query: TeamPerformanceByTeamsQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformanceByTeams(
      this.performanceByTeamsFilters(user, query, 'QUALITY'),
    );
  }

  @Get('safety-work/team-performance-by-teams')
  getSafetyWorkTeamPerformanceByTeams(
    @CurrentUser() user: any,
    @Query() query: TeamPerformanceByTeamsQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformanceByTeams(
      this.performanceByTeamsFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('non-conformities/by-checklist')
  getTopNonConformitiesByChecklist(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByChecklistQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByChecklist(
      this.nonConformitiesByChecklistFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/non-conformities/by-checklist')
  getQualityTopNonConformitiesByChecklist(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByChecklistQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByChecklist(
      this.nonConformitiesByChecklistFilters(user, query, 'QUALITY'),
    );
  }

  @Get('safety-work/non-conformities/by-checklist')
  getSafetyWorkTopNonConformitiesByChecklist(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByChecklistQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByChecklist(
      this.nonConformitiesByChecklistFilters(user, query, 'SAFETY_WORK'),
    );
  }

  @Get('non-conformities/by-team')
  getTopNonConformitiesByTeam(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByTeamQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByTeam(
      this.nonConformitiesByTeamFilters(user, query, 'QUALITY'),
    );
  }

  @Get('quality/non-conformities/by-team')
  getQualityTopNonConformitiesByTeam(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByTeamQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByTeam(
      this.nonConformitiesByTeamFilters(user, query, 'QUALITY'),
    );
  }

  @Get('safety-work/non-conformities/by-team')
  getSafetyWorkTopNonConformitiesByTeam(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByTeamQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByTeam(
      this.nonConformitiesByTeamFilters(user, query, 'SAFETY_WORK'),
    );
  }
}
