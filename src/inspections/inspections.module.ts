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
} from '../entities';
import { InspectionDomainService } from './inspection-domain.service';
import { SyncController } from './sync.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

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
    ]),
    CloudinaryModule,
  ],
  controllers: [InspectionsController, SyncController],
  providers: [InspectionsService, InspectionDomainService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
