import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InspectionsService } from './inspections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, ModuleType, InspectionStatus } from '../common/enums';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Controller('inspections')
@UseGuards(JwtAuthGuard)
export class InspectionsController {
  constructor(
    private readonly inspectionsService: InspectionsService,
    private configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL, UserRole.GESTOR)
  create(@Body() createInspectionDto: any, @CurrentUser() user: any) {
    return this.inspectionsService.create(createInspectionDto, user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  findAll(
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
    @Query('module') module?: ModuleType,
    @Query('teamId') teamId?: string,
    @Query('status') status?: InspectionStatus,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.inspectionsService.findAll(
      {
        periodFrom,
        periodTo,
        module,
        teamId,
        status,
      },
      pagination?.page || 1,
      pagination?.limit || 10,
    );
  }

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.FISCAL)
  findMine(
    @CurrentUser() user: any,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.inspectionsService.findMine(
      user.id,
      pagination?.page || 1,
      pagination?.limit || 10,
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
    return this.inspectionsService.update(id, updateInspectionDto, user.id, user.role);
  }

  @Put(':id/items')
  updateItems(
    @Param('id') id: string,
    @Body() items: any[],
  ) {
    return this.inspectionsService.updateItems(id, items);
  }

  @Post(':id/evidences')
  @UseInterceptors(FileInterceptor('file'))
  addEvidence(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5242880, // 5MB
          }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('inspectionItemId') inspectionItemId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.inspectionsService.addEvidence(id, file, inspectionItemId, user?.id);
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
  finalize(@Param('id') id: string, @CurrentUser() user: any) {
    return this.inspectionsService.finalize(id, user.id, user.role);
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GESTOR, UserRole.ADMIN)
  resolve(
    @Param('id') id: string,
    @Body() resolveDto: { resolutionNotes: string; resolutionEvidence?: string },
    @CurrentUser() user: any,
  ) {
    return this.inspectionsService.resolve(id, resolveDto, user.id);
  }
}
