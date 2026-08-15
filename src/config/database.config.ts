import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as entities from '../entities';

function resolveSsl(host: string) {
  const flag = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') {
    return { rejectUnauthorized: false };
  }
  if (flag === 'false' || flag === '0') {
    return false;
  }

  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'sanorte-postgres',
  ]);
  if (localHosts.has(host)) {
    return false;
  }

  return { rejectUnauthorized: false };
}

export function getDatabaseConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  function parseDatabaseUrl() {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (databaseUrl) {
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 5432,
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: resolveSsl(url.hostname),
      };
    }

    const host = configService.get('DB_HOST', 'localhost');
    return {
      host,
      port: configService.get('DB_PORT', 5432),
      username: configService.get('DB_USERNAME', 'postgres'),
      password: configService.get('DB_PASSWORD', 'postgres'),
      database: configService.get('DB_DATABASE', 'vistorias_db'),
      ssl: resolveSsl(host),
    };
  }

  const dbConfig = parseDatabaseUrl();

  return {
    type: 'postgres',
    ...dbConfig,
    entities: Object.values(entities),
    migrations: [
      path.join(__dirname, '../database/migrations/*.ts'),
      path.join(__dirname, '../database/migrations/*.js'), // Para produção (compilado)
    ],
    synchronize: false,
  };
}
