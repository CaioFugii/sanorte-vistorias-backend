import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ContractsService } from './contracts.service';
import {
  CreateCityDto,
  CreateContractDto,
  SetContractCitiesDto,
  UpdateCityDto,
  UpdateContractDto,
} from './dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.contractsService.findAll(
      pagination.page || 1,
      pagination.limit || 10,
    );
  }

  @Post()
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Put(':id/cities')
  setCities(@Param('id') id: string, @Body() dto: SetContractCitiesDto) {
    return this.contractsService.setCities(id, dto.cityIds || []);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
  }

  @Get('cities/list')
  findCities(@Query() pagination: PaginationQueryDto) {
    return this.contractsService.findCities(
      pagination.page || 1,
      pagination.limit || 50,
    );
  }

  @Post('cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.contractsService.createCity(dto);
  }

  @Put('cities/:id')
  updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.contractsService.updateCity(id, dto);
  }

  @Delete('cities/:id')
  removeCity(@Param('id') id: string) {
    return this.contractsService.removeCity(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }
}
