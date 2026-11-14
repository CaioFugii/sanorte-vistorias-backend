import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldSupervisor, Foreman, Team } from '../entities';
import { ForemenController } from './foremen.controller';
import { ForemenService } from './foremen.service';

@Module({
  imports: [TypeOrmModule.forFeature([Foreman, Team, FieldSupervisor])],
  controllers: [ForemenController],
  providers: [ForemenService],
  exports: [ForemenService],
})
export class ForemenModule {}
