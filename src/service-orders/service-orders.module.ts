import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  Inspection,
  ServiceOrder,
  ServiceOrderImport,
  ServiceOrderImportLine,
  Sector,
} from '../entities';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrderImportParserService } from './import/service-order-import-parser.service';
import { ServiceOrderSpreadsheetStorage } from './service-order-spreadsheet.storage';
import { ExcelModule } from '../excel/excel.module';
import { StorageModule } from '../storage/storage.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { ServiceOrdersExcelExporter } from './service-orders-excel.exporter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceOrder,
      Sector,
      Contract,
      Inspection,
      ServiceOrderImport,
      ServiceOrderImportLine,
    ]),
    ExcelModule,
    StorageModule,
    InspectionsModule,
  ],
  controllers: [ServiceOrdersController],
  providers: [
    ServiceOrdersService,
    ServiceOrderImportParserService,
    ServiceOrderSpreadsheetStorage,
    ServiceOrdersExcelExporter,
  ],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
