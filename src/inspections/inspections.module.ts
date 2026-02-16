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
  ChecklistSection,
} from '../entities';
import { FilesModule } from '../files/files.module';
import { InspectionDomainService } from './inspection-domain.service';
import { SyncController } from './sync.controller';

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
      ChecklistSection,
    ]),
    FilesModule,
  ],
  controllers: [InspectionsController, SyncController],
  providers: [InspectionsService, InspectionDomainService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
