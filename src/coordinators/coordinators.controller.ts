import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { CoordinatorsService } from './coordinators.service';
import {
  CreateCoordinatorDto,
  FilterCoordinatorsDto,
  UpdateCoordinatorDto,
} from './dto';

@Controller('coordinators')
@UseGuards(JwtAuthGuard)
export class CoordinatorsController {
  constructor(private readonly coordinatorsService: CoordinatorsService) {}

  @Get()
  findAll(@Query() query: FilterCoordinatorsDto) {
    return this.coordinatorsService.findAll(
      query.name,
      query.active,
      query.page || 1,
      query.limit || 10,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coordinatorsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCoordinatorDto) {
    return this.coordinatorsService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCoordinatorDto) {
    return this.coordinatorsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.coordinatorsService.remove(id);
  }
}
