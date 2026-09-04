import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract, Inspection, ServiceOrder, Sector } from '../entities';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrderImportParserService } from './import/service-order-import-parser.service';
import { ExcelModule } from '../excel/excel.module';
import { ServiceOrdersExcelExporter } from './service-orders-excel.exporter';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceOrder, Sector, Contract, Inspection]),
    ExcelModule,
  ],
  controllers: [ServiceOrdersController],
  providers: [
    ServiceOrdersService,
    ServiceOrderImportParserService,
    ServiceOrdersExcelExporter,
  ],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
