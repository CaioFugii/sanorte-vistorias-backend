import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract, Coordinator, FieldSupervisor, Foreman } from '../entities';
import { FieldSupervisorsController } from './field-supervisors.controller';
import { FieldSupervisorsService } from './field-supervisors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FieldSupervisor, Coordinator, Contract, Foreman]),
  ],
  controllers: [FieldSupervisorsController],
  providers: [FieldSupervisorsService],
  exports: [FieldSupervisorsService],
})
export class FieldSupervisorsModule {}
