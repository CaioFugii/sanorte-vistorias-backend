import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectorsController } from './sectors.controller';
import { SectorsService } from './sectors.service';
import { Sector, Collaborator, Checklist, ServiceOrder } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sector, Collaborator, Checklist, ServiceOrder]),
  ],
  controllers: [SectorsController],
  providers: [SectorsService],
  exports: [SectorsService],
})
export class SectorsModule {}
