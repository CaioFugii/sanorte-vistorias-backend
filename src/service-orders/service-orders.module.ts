import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceOrder, Sector } from '../entities';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrderImportParserService } from './import/service-order-import-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceOrder, Sector])],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService, ServiceOrderImportParserService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
