import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';
import { Inspection } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection])],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
