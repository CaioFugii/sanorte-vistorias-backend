import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as entities from '../entities';

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
        username: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove a barra inicial
        ssl: {
                  rejectUnauthorized: false, // Necessário para Heroku Postgres
                },
        // ssl:
        //   process.env.NODE_ENV === 'production'
        //     ? {
        //         rejectUnauthorized: false, // Necessário para Heroku Postgres
        //       }
        //     : false,
      };
    }

    return {
      host: configService.get('DB_HOST', 'localhost'),
      port: configService.get('DB_PORT', 5432),
      username: configService.get('DB_USERNAME', 'postgres'),
      password: configService.get('DB_PASSWORD', 'postgres'),
      database: configService.get('DB_DATABASE', 'vistorias_db'),
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
    logging: configService.get('NODE_ENV') === 'development',
  };
}
