import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import * as path from 'path';
import * as entities from '../entities';

config();

const configService = new ConfigService();

export const typeormConfig: DataSourceOptions = {
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DB_PASSWORD', 'postgres'),
  database: configService.get('DB_DATABASE', 'vistorias_db'),
  entities: Object.values(entities),
  migrations: [path.join(__dirname, '../database/migrations/*.ts')],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
};

export default new DataSource(typeormConfig);
