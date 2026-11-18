import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  StreamableFile,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  ParseUUIDPipe,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ServiceOrdersService } from './service-orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { FilterServiceOrdersDto } from './dto/filter-service-orders.dto';
import { ReprocessServiceOrderImportLineDto } from './dto/reprocess-service-order-import-line.dto';
import { BulkDeleteServiceOrdersDto } from './dto/bulk-delete-service-orders.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ExcelService } from '../excel/excel.service';
import { ServiceOrdersExcelExporter } from './service-orders-excel.exporter';

@Controller('service-orders')
@UseGuards(JwtAuthGuard)
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly serviceOrdersExcelExporter: ServiceOrdersExcelExporter,
    private readonly excelService: ExcelService,
  ) {}

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  summarize(@CurrentUser() user: any, @Query() query: FilterServiceOrdersDto) {
    return this.serviceOrdersService.summarize(user, {
      osNumber: query.osNumber,
      contractId: query.contractId,
      sectorId: query.sectorId,
      field: query.field,
      remote: query.remote,
      postWork: query.postWork,
      equipe: query.equipe,
      resultado: query.resultado,
      postWorkEligible: query.postWorkEligible,
      from: query.from,
      to: query.to,
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  findAll(@CurrentUser() user: any, @Query() query: FilterServiceOrdersDto) {
    return this.serviceOrdersService.findAll(
      user,
      query.page || 1,
      query.limit || 10,
      query.osNumber,
      query.contractId,
      query.from,
      query.to,
      query.sectorId,
      query.field,
      query.remote,
      query.postWork,
      query.equipe,
      query.resultado,
      query.postWorkEligible,
    );
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR, UserRole.FISCAL)
  async exportExcel(
    @CurrentUser() user: any,
    @Query() query: FilterServiceOrdersDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.serviceOrdersExcelExporter.export(
      {
        osNumber: query.osNumber,
        contractId: query.contractId,
        from: query.from,
        to: query.to,
        sectorId: query.sectorId,
        field: query.field,
        remote: query.remote,
        postWork: query.postWork,
        equipe: query.equipe,
        resultado: query.resultado,
        postWorkEligible: query.postWorkEligible,
      },
      user,
    );
    return this.excelService.attachToResponse(file, res);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.SUPERVISOR)
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
    @CurrentUser() user: any,
    @Body('contractId', new ParseUUIDPipe({ version: '4' }))
    contractId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /(vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel)/,
            skipMagicNumbersValidation: true,
          }),
        ],
        exceptionFactory: (errors: unknown) => {
          const msg =
            typeof errors === 'string'
              ? errors
              : Array.isArray(errors)
                ? errors.map((e: unknown) => String(e)).join('; ')
                : String(errors);
          return new BadRequestException(
            `Arquivo inválido: ${msg}. Envie um arquivo Excel (.xlsx ou .xls) com colunas "Numero da OS" e "Endereço".`,
          );
        },
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.serviceOrdersService.importFromExcel(user, file, contractId);
  }

  @Get('imports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  listImports(
    @CurrentUser() user: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.serviceOrdersService.listImports(
      user,
      query.page || 1,
      query.limit || 10,
    );
  }

  @Get('imports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  getImport(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.serviceOrdersService.getImport(user, id);
  }

  @Get('imports/:id/file')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  async downloadImportFile(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    const file = await this.serviceOrdersService.downloadImportFile(user, id);
    const fileName = file.fileName.replace(/"/g, '');
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Post('imports/:id/lines/:lineId/reprocess')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  reprocessLine(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @Body() body: ReprocessServiceOrderImportLineDto,
  ) {
    return this.serviceOrdersService.reprocessLine(user, id, lineId, body.row);
  }

  @Post('bulk-delete')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async bulkDelete(@Body() body: BulkDeleteServiceOrdersDto): Promise<void> {
    await this.serviceOrdersService.removeMany(body.ids);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.serviceOrdersService.remove(id);
  }
}
