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
import {
  CreateFieldSupervisorDto,
  FilterFieldSupervisorsDto,
  UpdateFieldSupervisorDto,
} from './dto';
import { FieldSupervisorsService } from './field-supervisors.service';

@Controller('field-supervisors')
@UseGuards(JwtAuthGuard)
export class FieldSupervisorsController {
  constructor(private readonly fieldSupervisorsService: FieldSupervisorsService) {}

  @Get()
  findAll(@Query() query: FilterFieldSupervisorsDto) {
    return this.fieldSupervisorsService.findAll(
      query.name,
      query.active,
      query.page || 1,
      query.limit || 10,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fieldSupervisorsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateFieldSupervisorDto) {
    return this.fieldSupervisorsService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldSupervisorDto,
  ) {
    return this.fieldSupervisorsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.fieldSupervisorsService.remove(id);
  }
}
