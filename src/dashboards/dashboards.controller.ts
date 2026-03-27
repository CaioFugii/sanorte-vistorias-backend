import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import {
  CurrentMonthByServiceQueryDto,
  DashboardQueryDto,
  LowScoreCollaboratorsQueryDto,
  QualityByServiceQueryDto,
  TeamPerformanceByTeamsQueryDto,
} from './dto';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.GESTOR)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('summary')
  getSummary(@Query() query: DashboardQueryDto) {
    return this.dashboardsService.getSummary({
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
    });
  }

  @Get('ranking/teams')
  getTeamsRanking(@Query() query: DashboardQueryDto) {
    return this.dashboardsService.getTeamsRanking({
      from: query.from,
      to: query.to,
      module: query.module,
    });
  }

  @Get('teams/:teamId')
  getTeamPerformance(
    @Param('teamId') teamId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardsService.getTeamPerformance(teamId, {
      from: query.from,
      to: query.to,
      module: query.module,
    });
  }

  @Get('quality-by-service')
  getQualityByService(@Query() query: QualityByServiceQueryDto) {
    return this.dashboardsService.getQualityByService({
      from: query.from,
      to: query.to,
      module: query.module,
      teamId: query.teamId,
    });
  }

  @Get('current-month-by-service')
  getCurrentMonthByService(@Query() query: CurrentMonthByServiceQueryDto) {
    return this.dashboardsService.getCurrentMonthByService({
      month: query.month,
      module: query.module,
      teamId: query.teamId,
    });
  }

  @Get('safety-work/low-score-collaborators')
  getLowScoreCollaborators(@Query() query: LowScoreCollaboratorsQueryDto) {
    return this.dashboardsService.getLowScoreCollaborators({
      from: query.from,
      to: query.to,
      lowScoreThreshold: query.lowScoreThreshold,
      limit: query.limit,
    });
  }

  @Get('team-performance-by-teams')
  getTeamPerformanceByTeams(@Query() query: TeamPerformanceByTeamsQueryDto) {
    return this.dashboardsService.getTeamPerformanceByTeams({
      from: query.from,
      to: query.to,
      teamIdsCsv: query.teamIds,
    });
  }
}
