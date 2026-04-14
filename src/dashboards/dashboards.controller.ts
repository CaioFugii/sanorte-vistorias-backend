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
  QualityByServiceQueryDto,
  TeamPerformanceByTeamsQueryDto,
} from './dto';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GESTOR)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: any, @Query() query: DashboardQueryDto) {
    return this.dashboardsService.getSummary({
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
    });
  }

  @Get('ranking/teams')
  getTeamsRanking(@CurrentUser() user: any, @Query() query: DashboardQueryDto) {
    return this.dashboardsService.getTeamsRanking({
      user,
      from: query.from,
      to: query.to,
      module: query.module,
    });
  }

  @Get('teams/:teamId')
  getTeamPerformance(
    @CurrentUser() user: any,
    @Param('teamId') teamId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformance(teamId, {
      user,
      from: query.from,
      to: query.to,
      module: query.module,
    });
  }

  @Get('quality-by-service')
  getQualityByService(
    @CurrentUser() user: any,
    @Query() query: QualityByServiceQueryDto,
  ) {
    return this.dashboardsService.getQualityByService({
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
    });
  }

  @Get('current-month-by-service')
  getCurrentMonthByService(
    @CurrentUser() user: any,
    @Query() query: CurrentMonthByServiceQueryDto,
  ) {
    return this.dashboardsService.getCurrentMonthByService({
      user,
      month: query.month,
      module: query.module,
      teamId: query.teamId,
    });
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
    });
  }

  @Get('team-performance-by-teams')
  getTeamPerformanceByTeams(
    @CurrentUser() user: any,
    @Query() query: TeamPerformanceByTeamsQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformanceByTeams({
      user,
      from: query.from,
      to: query.to,
      teamIdsCsv: query.teamIds,
    });
  }

  @Get('non-conformities/by-checklist')
  getTopNonConformitiesByChecklist(
    @CurrentUser() user: any,
    @Query() query: NonConformitiesByChecklistQueryDto,
  ) {
    return this.dashboardsService.getTopNonConformitiesByChecklist({
      user,
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
      limitPerChecklist: query.limitPerChecklist,
    });
  }
}
