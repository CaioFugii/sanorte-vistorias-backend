import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';
import appConfig from './config/app.config';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { InspectionsModule } from './inspections/inspections.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { FilesModule } from './files/files.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => typeormConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    TeamsModule,
    CollaboratorsModule,
    ChecklistsModule,
    InspectionsModule,
    DashboardsModule,
    FilesModule,
    PdfModule,
  ],
})
export class AppModule {}
