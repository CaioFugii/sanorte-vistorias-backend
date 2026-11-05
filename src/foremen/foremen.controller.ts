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
import { ForemenService } from './foremen.service';
import { CreateForemanDto, FilterForemenDto, UpdateForemanDto } from './dto';

@Controller('foremen')
@UseGuards(JwtAuthGuard)
export class ForemenController {
  constructor(private readonly foremenService: ForemenService) {}

  @Get()
  findAll(@Query() query: FilterForemenDto) {
    return this.foremenService.findAll(
      query.name,
      query.active,
      query.page || 1,
      query.limit || 10,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.foremenService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateForemanDto) {
    return this.foremenService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateForemanDto) {
    return this.foremenService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.foremenService.remove(id);
  }
}
