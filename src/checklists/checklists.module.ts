import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';
import { Checklist, ChecklistItem, ChecklistSection, Inspection } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Checklist, ChecklistItem, ChecklistSection, Inspection]),
  ],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
