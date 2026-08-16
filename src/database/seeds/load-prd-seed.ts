import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';
import {
  INSERT_TABLE_ORDER,
  PrdSnapshot,
  SNAPSHOT_RELATIVE_PATH,
  SnapshotColumn,
} from './prd-seed.config';
import { assertLoadTargetIsLocal } from './seed-db-guard';
import { DataSource } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { ensureDefaultUsersAndSectors } from './ensure-default-users';

config();

const INSERT_BATCH_SIZE = 100;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function toSqlValue(
  value: unknown,
  column: SnapshotColumn,
): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (column.udtName === 'date' && typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (column.udtName === 'jsonb' || column.udtName === 'json') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value;
}

async function insertTable(
  client: Client,
  table: string,
  columns: SnapshotColumn[],
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) {
    console.log(`• ${table}: 0 linhas`);
    return;
  }

  const columnNames = columns.map((column) => column.name);
  const quotedTable = quoteIdent(table);
  const quotedColumns = columnNames.map(quoteIdent).join(', ');

  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const values: unknown[] = [];
    const tuples = batch.map((row, rowIndex) => {
      const placeholders = columnNames.map((name, columnIndex) => {
        const column = columns[columnIndex];
        values.push(toSqlValue(row[name], column));
        return `$${rowIndex * columnNames.length + columnIndex + 1}${
          column.udtName === 'jsonb' || column.udtName === 'json' ? '::jsonb' : ''
        }`;
      });
      return `(${placeholders.join(', ')})`;
    });

    await client.query(
      `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES ${tuples.join(', ')}`,
      values,
    );
  }

  console.log(`✓ ${table}: ${rows.length} linhas`);
}

export async function loadPrdSnapshot(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('Defina DATABASE_URL apontando para o Postgres local.');
  }
  assertLoadTargetIsLocal(databaseUrl);

  const snapshotPath = path.resolve(process.cwd(), SNAPSHOT_RELATIVE_PATH);
  if (!existsSync(snapshotPath)) {
    throw new Error(
      `Snapshot não encontrado em ${SNAPSHOT_RELATIVE_PATH}. Rode npm run seed:dump-prd.`,
    );
  }

  const snapshot = JSON.parse(
    await readFile(snapshotPath, 'utf8'),
  ) as PrdSnapshot;

  const client = new Client({
    connectionString: databaseUrl,
    ssl: false,
  });
  await client.connect();
  console.log('→ Conectado ao Postgres local');

  try {
    await client.query('BEGIN');
    const truncateList = [...INSERT_TABLE_ORDER]
      .reverse()
      .map(quoteIdent)
      .join(', ');
    await client.query(
      `TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`,
    );

    for (const table of INSERT_TABLE_ORDER) {
      const payload = snapshot.tables[table];
      if (!payload) {
        console.log(`• ${table}: ausente no snapshot`);
        continue;
      }
      await insertTable(client, table, payload.columns, payload.rows);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  const dataSource = new DataSource(typeormConfig);
  await dataSource.initialize();
  try {
    await ensureDefaultUsersAndSectors(dataSource, {
      resetAllPasswords: true,
    });
  } finally {
    await dataSource.destroy();
  }

  console.log('\nSeed de PRD carregado no banco local.');
}

if (require.main === module) {
  loadPrdSnapshot().catch((error) => {
    console.error('Erro ao carregar seed de PRD:', error);
    process.exit(1);
  });
}
