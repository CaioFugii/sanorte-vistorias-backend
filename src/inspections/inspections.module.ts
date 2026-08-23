import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import {
  Inspection,
  InspectionItem,
  Evidence,
  Signature,
  PendingAdjustment,
  ChecklistItem,
  Checklist,
  Collaborator,
  Team,
  ChecklistSection,
  ServiceOrder,
  InvestmentWork,
} from '../entities';
import { InspectionDomainService } from './inspection-domain.service';
import { InspectionsExcelExporter } from './inspections-excel.exporter';
import { SyncController } from './sync.controller';
import { StorageModule } from '../storage/storage.module';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inspection,
      InspectionItem,
      Evidence,
      Signature,
      PendingAdjustment,
      ChecklistItem,
      Checklist,
      Collaborator,
      Team,
      ChecklistSection,
      ServiceOrder,
      InvestmentWork,
    ]),
    StorageModule,
    ExcelModule,
  ],
  controllers: [InspectionsController, SyncController],
  providers: [InspectionsService, InspectionDomainService, InspectionsExcelExporter],
  exports: [InspectionsService],
})
export class InspectionsModule {}
