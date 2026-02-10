import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import * as path from 'path';
import * as entities from '../entities';
import { getDatabaseConfig } from './database.config';

config();

const configService = new ConfigService();
const dbConfig = getDatabaseConfig(configService);

export const typeormConfig: DataSourceOptions = {
  ...dbConfig,
} as DataSourceOptions;

export default new DataSource(typeormConfig);
