import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SectorsService } from './sectors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Controller('sectors')
@UseGuards(JwtAuthGuard)
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.sectorsService.findAll(
      pagination.page || 1,
      pagination.limit || 10,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sectorsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createSectorDto: any) {
    return this.sectorsService.create(createSectorDto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateSectorDto: any) {
    return this.sectorsService.update(id, updateSectorDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.sectorsService.remove(id);
  }
}
