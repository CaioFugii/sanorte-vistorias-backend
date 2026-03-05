import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('dashboards')
@UseGuards(JwtAuthGuard)
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
}
