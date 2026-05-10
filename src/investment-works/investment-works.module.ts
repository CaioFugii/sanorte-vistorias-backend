import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  Inspection,
  InvestmentWork,
  PendingAdjustment,
  Team,
} from '../entities';
import { InvestmentWorksController } from './investment-works.controller';
import { InvestmentWorksService } from './investment-works.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvestmentWork,
      Contract,
      Team,
      Inspection,
      PendingAdjustment,
    ]),
  ],
  controllers: [InvestmentWorksController],
  providers: [InvestmentWorksService],
  exports: [InvestmentWorksService],
})
export class InvestmentWorksModule {}
