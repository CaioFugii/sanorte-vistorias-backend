import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';
import { Inspection, Team } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, Team])],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
