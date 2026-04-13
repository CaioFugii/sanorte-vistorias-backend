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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChecklistsService } from './checklists.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { FilterChecklistsDto } from './dto/filter-checklists.dto';

@Controller('checklists')
@UseGuards(JwtAuthGuard)
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get()
  findAll(@Query() query: FilterChecklistsDto) {
    return this.checklistsService.findAll(
      query.module,
      query.inspectionScope,
      query.active,
      query.sectorId,
      query.page || 1,
      query.limit || 10,
    );
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

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeChecklist(@Param('id') id: string) {
    return this.checklistsService.removeChecklist(id);
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  addItem(@Param('id') id: string, @Body() createItemDto: any) {
    return this.checklistsService.addItem(id, createItemDto);
  }

  @Post(':id/sections')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  addSection(@Param('id') id: string, @Body() createSectionDto: any) {
    return this.checklistsService.addSection(id, createSectionDto);
  }

  @Put(':id/sections/:sectionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() updateSectionDto: any,
  ) {
    return this.checklistsService.updateSection(
      id,
      sectionId,
      updateSectionDto,
    );
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

  @Post(':id/items/:itemId/reference-image')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadItemReferenceImage(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/.*/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.checklistsService.uploadItemReferenceImage(id, itemId, file);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.checklistsService.removeItem(id, itemId);
  }
}
