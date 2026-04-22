import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from '@/cloudinary/cloudinary.module';
import {
  ReportFile,
  ReportRecord,
  ReportType,
  ReportTypeField,
} from '@/entities';
import { ReportsController } from '@/reports/reports.controller';
import { ReportsService } from '@/reports/reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportType, ReportTypeField, ReportRecord, ReportFile]),
    CloudinaryModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
