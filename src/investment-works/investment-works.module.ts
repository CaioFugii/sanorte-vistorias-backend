import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpreadsheetStorageService } from '../common/utils/spreadsheet-storage.service';
import {
  Contract,
  Inspection,
  InvestmentWork,
  InvestmentWorkDescription,
  InvestmentWorkImport,
  InvestmentWorkImportLine,
  PendingAdjustment,
  Sector,
  Team,
} from '../entities';
import { StorageModule } from '../storage/storage.module';
import { InvestmentWorkImportParserService } from './import/investment-work-import-parser.service';
import { InvestmentWorkImportService } from './import/investment-work-import.service';
import { InvestmentWorkImportsController } from './investment-work-imports.controller';
import { InvestmentWorksController } from './investment-works.controller';
import { InvestmentWorkSummaryService } from './investment-work-summary.service';
import { InvestmentWorksService } from './investment-works.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvestmentWork,
      Contract,
      Team,
      Inspection,
      PendingAdjustment,
      InvestmentWorkDescription,
      InvestmentWorkImport,
      InvestmentWorkImportLine,
      Sector,
    ]),
    StorageModule,
  ],
  controllers: [InvestmentWorkImportsController, InvestmentWorksController],
  providers: [
    InvestmentWorksService,
    InvestmentWorkSummaryService,
    InvestmentWorkImportParserService,
    InvestmentWorkImportService,
    SpreadsheetStorageService,
  ],
  exports: [InvestmentWorksService],
})
export class InvestmentWorksModule {}
