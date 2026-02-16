import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';
import { Checklist, ChecklistItem, ChecklistSection } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Checklist, ChecklistItem, ChecklistSection])],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
