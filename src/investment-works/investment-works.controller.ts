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
import { UserRole } from '../common/enums';
import { InvestmentWorksService } from './investment-works.service';
import {
  CreateInvestmentWorkDto,
  FilterInvestmentWorksDto,
  UpdateInvestmentWorkDto,
} from './dto';

@Controller('investment-works')
@UseGuards(JwtAuthGuard)
export class InvestmentWorksController {
  constructor(
    private readonly investmentWorksService: InvestmentWorksService,
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

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.investmentWorksService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR)
  create(@Body() dto: CreateInvestmentWorkDto, @CurrentUser() user: any) {
    return this.investmentWorksService.create(dto, user);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvestmentWorkDto,
    @CurrentUser() user: any,
  ) {
    return this.investmentWorksService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.investmentWorksService.remove(id, user);
  }
}
