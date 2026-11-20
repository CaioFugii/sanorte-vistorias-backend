import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessProfile, AccessProfileArea, User } from '../entities';
import { AccessProfilesController } from './access-profiles.controller';
import { AccessProfilesService } from './access-profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessProfile, AccessProfileArea, User])],
  controllers: [AccessProfilesController],
  providers: [AccessProfilesService],
  exports: [AccessProfilesService],
})
export class AccessProfilesModule {}
