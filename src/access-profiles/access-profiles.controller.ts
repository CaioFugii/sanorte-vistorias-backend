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
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AccessProfilesService } from './access-profiles.service';
import {
  CreateAccessProfileDto,
  DuplicateAccessProfileDto,
  UpdateAccessProfileDto,
} from './dto';

@Controller('access-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AccessProfilesController {
  constructor(private readonly accessProfilesService: AccessProfilesService) {}

  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.accessProfilesService.findAll(
      pagination.page || 1,
      pagination.limit || 10,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accessProfilesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccessProfileDto) {
    return this.accessProfilesService.create(dto);
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateAccessProfileDto,
  ) {
    return this.accessProfilesService.duplicate(id, dto.name);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessProfileDto,
  ) {
    return this.accessProfilesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accessProfilesService.remove(id);
  }
}
