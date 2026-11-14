import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionNotice, User } from '../entities';
import { InspectionNoticesController } from './inspection-notices.controller';
import { InspectionNoticesService } from './inspection-notices.service';

@Module({
  imports: [TypeOrmModule.forFeature([InspectionNotice, User])],
  controllers: [InspectionNoticesController],
  providers: [InspectionNoticesService],
  exports: [InspectionNoticesService],
})
export class InspectionNoticesModule {}
