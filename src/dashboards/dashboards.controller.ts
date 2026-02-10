import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleType } from '../common/enums';

@Controller('dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('summary')
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('module') module?: ModuleType,
    @Query('teamId') teamId?: string,
  ) {
    return this.dashboardsService.getSummary({ from, to, module, teamId });
  }

  @Get('ranking/teams')
  getTeamsRanking(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('module') module?: ModuleType,
  ) {
    return this.dashboardsService.getTeamsRanking({ from, to, module });
  }
}
