import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessArea } from '../common/enums';
import { assertCanSeeArea } from '../common/auth/access-area.assert';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('types')
  findTypes(@CurrentUser() user: any) {
    assertCanSeeArea(user, AccessArea.ENGENHARIA_RELATORIOS);
    return this.reportsService.findActiveTypes();
  }

  @Get('types/:code/fields')
  findTypeFields(@CurrentUser() user: any, @Param('code') code: string) {
    assertCanSeeArea(user, AccessArea.ENGENHARIA_RELATORIOS);
    return this.reportsService.findTypeFields(code);
  }
}
