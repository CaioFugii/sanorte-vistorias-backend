import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';
import {
  Checklist,
  ChecklistItem,
  ChecklistSection,
  Inspection,
  Sector,
} from '../entities';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    CloudinaryModule,
    TypeOrmModule.forFeature([
      Checklist,
      ChecklistItem,
      ChecklistSection,
      Inspection,
      Sector,
    ]),
  ],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
