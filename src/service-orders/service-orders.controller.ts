import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServiceOrdersService } from './service-orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { FilterServiceOrdersDto } from './dto/filter-service-orders.dto';

@Controller('service-orders')
@UseGuards(JwtAuthGuard)
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR, UserRole.FISCAL)
  findAll(@CurrentUser() user: any, @Query() query: FilterServiceOrdersDto) {
    return this.serviceOrdersService.findAll(
      user,
      query.page || 1,
      query.limit || 10,
      query.osNumber,
      query.sectorId,
      query.field,
      query.remote,
      query.postWork,
    );
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.GESTOR)
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
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
    return this.serviceOrdersService.importFromExcel(file);
  }
}
