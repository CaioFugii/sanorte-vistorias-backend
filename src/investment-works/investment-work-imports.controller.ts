import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  assertCanSeeAllAreas,
  assertCanSeeArea,
} from '../common/auth/access-area.assert';
import { AreaAction, AreaActionGuard } from '../common/auth/area-action.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AccessArea, UserRole } from '../common/enums';
import { INVESTMENT_WORK_IMPORT_MAX_BYTES } from './import/investment-work-import.service';
import { InvestmentWorkImportService } from './import/investment-work-import.service';

const excelFilePipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: INVESTMENT_WORK_IMPORT_MAX_BYTES }),
    new FileTypeValidator({
      fileType:
        /(vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel)/,
      skipMagicNumbersValidation: true,
    }),
  ],
  exceptionFactory: () =>
    new BadRequestException(
      'Arquivo inválido. Envie um Excel (.xlsx ou .xls) de até 5 MB.',
    ),
});

@Controller('investment-works')
@UseGuards(JwtAuthGuard)
export class InvestmentWorkImportsController {
  constructor(private readonly imports: InvestmentWorkImportService) {}

  @Post('imports/preview')
  @HttpCode(200)
  @UseGuards(AreaActionGuard)
  @AreaAction(AccessArea.QUALIDADE_PAINEL, [
    UserRole.ADMIN,
    UserRole.GESTOR,
    UserRole.SUPERVISOR,
  ])
  @UseInterceptors(FileInterceptor('file'))
  preview(
    @CurrentUser() user: any,
    @UploadedFile(excelFilePipe) file: Express.Multer.File,
  ) {
    assertCanSeeArea(user, AccessArea.ENGENHARIA_OBRAS);
    return this.imports.preview(file);
  }

  @Post('imports')
  @UseGuards(AreaActionGuard)
  @AreaAction(AccessArea.QUALIDADE_PAINEL, [
    UserRole.ADMIN,
    UserRole.GESTOR,
    UserRole.SUPERVISOR,
  ])
  @UseInterceptors(FileInterceptor('file'))
  importFile(
    @CurrentUser() user: any,
    @Body('contractId', new ParseUUIDPipe({ version: '4' })) contractId: string,
    @Body('descriptions') descriptions: string,
    @UploadedFile(excelFilePipe) file: Express.Multer.File,
  ) {
    assertCanSeeArea(user, AccessArea.ENGENHARIA_OBRAS);
    return this.imports.importFile(
      user,
      file,
      contractId,
      this.parseDescriptions(descriptions),
    );
  }

  @Get('imports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  list(@CurrentUser() user: any, @Query() query: PaginationQueryDto) {
    this.assertHistory(user);
    return this.imports.listImports(user, query.page || 1, query.limit || 10);
  }

  @Get('imports/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  getOne(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    this.assertHistory(user);
    return this.imports.getImport(user, id);
  }

  @Get('imports/:id/file')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  async download(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    this.assertHistory(user);
    const file = await this.imports.downloadImportFile(user, id);
    const fileName = file.fileName.replace(/"/g, '');
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  private assertHistory(user: any): void {
    assertCanSeeAllAreas(user, [
      AccessArea.QUALIDADE_PAINEL,
      AccessArea.ENGENHARIA_OBRAS,
    ]);
  }

  private parseDescriptions(raw: string): string[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('descriptions inválido');
    }
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== 'string')
    ) {
      throw new BadRequestException('descriptions inválido');
    }
    return parsed;
  }
}
