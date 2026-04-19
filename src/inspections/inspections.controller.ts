import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createTempDiskStorage } from '../common/multer/temp-disk.storage';
import { InspectionsService } from './inspections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { FilterInspectionsDto } from './dto/filter-inspections.dto';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { ResolveItemDto } from './dto/resolve-item.dto';
import { ParalyzeInspectionDto } from './dto/paralyze-inspection.dto';

@Controller('inspections')
@UseGuards(JwtAuthGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR)
  create(
    @Body() createInspectionDto: CreateInspectionDto,
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.create(createInspectionDto, user.id, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  findAll(@CurrentUser() user: any, @Query() filterDto: FilterInspectionsDto) {
    return this.inspectionsService.findAll(
      {
        periodFrom: filterDto.periodFrom,
        periodTo: filterDto.periodTo,
        module: filterDto.module,
        inspectionScope: filterDto.inspectionScope,
        teamId: filterDto.teamId,
        status: filterDto.status,
        osNumber: filterDto.osNumber,
      },
      filterDto.page || 1,
      filterDto.limit || 10,
      user,
    );
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL)
  findMine(@CurrentUser() user: any, @Query() filterDto: FilterInspectionsDto) {
    return this.inspectionsService.findMine(
      user.id,
      filterDto.page || 1,
      filterDto.limit || 10,
      filterDto.osNumber,
      filterDto.inspectionScope,
      user,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inspectionsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateInspectionDto: any,
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.update(
      id,
      updateInspectionDto,
      user.id,
      user.role,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  async remove(@Param('id') id: string): Promise<void> {
    await this.inspectionsService.remove(id);
  }

  @Put(':id/items')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  updateItems(
    @Param('id') id: string,
    @Body() items: any[],
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.updateItems(id, items, user.id, user.role);
  }

  @Post(':id/evidences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createTempDiskStorage('sanorte-evidence'),
      limits: { fileSize: 5242880 },
    }),
  )
  addEvidence(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5242880, // 5MB
          }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp)$/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('inspectionItemId') inspectionItemId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.inspectionsService.addEvidence(
      id,
      file,
      inspectionItemId,
      user?.id,
      user?.role,
    );
  }

  @Post(':id/signature')
  addSignature(
    @Param('id') id: string,
    @Body() signatureDto: { signerName: string; imageBase64: string },
  ) {
    return this.inspectionsService.addSignature(
      id,
      signatureDto.signerName,
      signatureDto.imageBase64,
    );
  }

  @Post(':id/finalize')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR)
  finalize(@Param('id') id: string) {
    return this.inspectionsService.finalize(id);
  }

  @Post(':id/paralyze')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  paralyze(
    @Param('id') id: string,
    @Body() paralyzeInspectionDto: ParalyzeInspectionDto,
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.paralyze(
      id,
      paralyzeInspectionDto.reason,
      user.id,
    );
  }

  @Post(':id/unparalyze')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GESTOR, UserRole.ADMIN)
  unparalyze(@Param('id') id: string) {
    return this.inspectionsService.unparalyze(id);
  }

  @Post(':id/items/:itemId/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  resolveItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() resolveItemDto: ResolveItemDto,
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.resolveItem(
      id,
      itemId,
      resolveItemDto,
      user.id,
    );
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR, UserRole.ADMIN)
  resolve(
    @Param('id') id: string,
    @Body()
    resolveDto: { resolutionNotes: string; resolutionEvidence?: string },
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.resolve(id, resolveDto, user.id);
  }
}
