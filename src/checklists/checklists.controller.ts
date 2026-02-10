import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, ModuleType } from '../common/enums';

@Controller('checklists')
@UseGuards(JwtAuthGuard)
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get()
  findAll(@Query('module') module?: ModuleType) {
    return this.checklistsService.findAll(module);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.checklistsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createChecklistDto: any) {
    return this.checklistsService.create(createChecklistDto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateChecklistDto: any) {
    return this.checklistsService.update(id, updateChecklistDto);
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  addItem(@Param('id') id: string, @Body() createItemDto: any) {
    return this.checklistsService.addItem(id, createItemDto);
  }

  @Put(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: any,
  ) {
    return this.checklistsService.updateItem(id, itemId, updateItemDto);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.checklistsService.removeItem(id, itemId);
  }
}
