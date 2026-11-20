import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AreaAction, AreaActionGuard } from '../common/auth/area-action.guard';
import { assertCanSeeAllAreas } from '../common/auth/access-area.assert';
import { AccessArea, UserRole } from '../common/enums';
import { InvestmentWorksService } from './investment-works.service';
import { InvestmentWorkSummaryService } from './investment-work-summary.service';
import {
  CreateInvestmentWorkDto,
  FilterInvestmentWorksDto,
  InvestmentWorkSummaryQueryDto,
  UpdateInvestmentWorkDto,
} from './dto';

@Controller('investment-works')
@UseGuards(JwtAuthGuard)
export class InvestmentWorksController {
  constructor(
    private readonly investmentWorksService: InvestmentWorksService,
    private readonly summaryService: InvestmentWorkSummaryService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  findAll(
    @CurrentUser() user: any,
    @Query() filters: FilterInvestmentWorksDto,
  ) {
    return this.investmentWorksService.findAll(
      user,
      filters.page || 1,
      filters.limit || 10,
      filters,
    );
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  summarize(
    @CurrentUser() user: any,
    @Query() query: InvestmentWorkSummaryQueryDto,
  ) {
    assertCanSeeAllAreas(user, [
      AccessArea.QUALIDADE_PAINEL,
      AccessArea.ENGENHARIA_OBRAS,
    ]);
    return this.summaryService.summarize(user, query);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.investmentWorksService.findOne(id, user);
  }

  @Post()
  @UseGuards(AreaActionGuard)
  @AreaAction(AccessArea.ENGENHARIA_OBRAS, [UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR])
  create(@Body() dto: CreateInvestmentWorkDto, @CurrentUser() user: any) {
    return this.investmentWorksService.create(dto, user);
  }

  @Put(':id')
  @UseGuards(AreaActionGuard)
  @AreaAction(AccessArea.ENGENHARIA_OBRAS, [UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR])
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvestmentWorkDto,
    @CurrentUser() user: any,
  ) {
    return this.investmentWorksService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AreaActionGuard)
  @AreaAction(AccessArea.ENGENHARIA_OBRAS, [UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR])
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.investmentWorksService.remove(id, user);
  }
}
