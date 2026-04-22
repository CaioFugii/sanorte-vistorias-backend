import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import appConfig from './config/app.config';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { SectorsModule } from './sectors/sectors.module';
import { CollaboratorsModule } from './collaborators/collaborators.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { InspectionsModule } from './inspections/inspections.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { FilesModule } from './files/files.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { UploadsModule } from './uploads/uploads.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';
import { ContractsModule } from './contracts/contracts.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    TeamsModule,
    SectorsModule,
    CollaboratorsModule,
    ChecklistsModule,
    InspectionsModule,
    DashboardsModule,
    FilesModule,
    CloudinaryModule,
    UploadsModule,
    ServiceOrdersModule,
    ContractsModule,
    ReportsModule,
  ],
})
export class AppModule {}
