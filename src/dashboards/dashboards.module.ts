import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';
import { Inspection, Team } from '../entities';
import { ExcelModule } from '../excel/excel.module';
import { QualityRankingExcelExporter } from './quality-ranking-excel.exporter';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, Team]), ExcelModule],
  controllers: [DashboardsController],
  providers: [DashboardsService, QualityRankingExcelExporter],
})
export class DashboardsModule {}
