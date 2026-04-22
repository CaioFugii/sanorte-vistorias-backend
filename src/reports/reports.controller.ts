import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Post,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { createTempDiskStorage } from '@/common/multer/temp-disk.storage';
import { CreateReportRecordDto } from '@/reports/dto/create-report-record.dto';
import { UploadReportFileDto } from '@/reports/dto/upload-report-file.dto';
import { ReportsService } from '@/reports/reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('types')
  findTypes() {
    return this.reportsService.findActiveTypes();
  }

  @Get('types/:code/fields')
  findTypeFields(@Param('code') code: string) {
    return this.reportsService.findTypeFields(code);
  }

  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createTempDiskStorage('sanorte-report-file'),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/.*/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadReportFileDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.uploadFile(file, dto, user.id);
  }

  @Post('records')
  createRecord(@Body() dto: CreateReportRecordDto, @CurrentUser() user: any) {
    return this.reportsService.createRecord(dto, user.id, user.role);
  }

  @Get('records/:id')
  findRecord(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.findRecordById(id, user.id, user.role);
  }
}
