import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';
import {
  FULL_COPY_TABLES,
  PrdSnapshot,
  QUALITY_SEED_SERVICES,
  SEED_INSPECTION_MONTHS,
  SEED_INSPECTIONS_PER_MONTH_PER_SERVICE,
  SEED_ROW_LIMIT,
  SEED_SAFETY_INSPECTION_LIMIT,
  SNAPSHOT_RELATIVE_PATH,
  SnapshotColumn,
  SnapshotTable,
  sanitizeSeedTimestamp,
} from './prd-seed.config';
import { assertDumpSourceIsRemote } from './seed-db-guard';

config();

type PgClient = Client;

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = sanitizeSeedTimestamp(value);
  }
  return normalized;
}

async function getColumns(
  client: PgClient,
  table: string,
): Promise<SnapshotColumn[]> {
  const result = await client.query(
    `
      SELECT column_name AS name, data_type AS "dataType", udt_name AS "udtName"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table],
  );
  return result.rows;
}

async function fetchAll(
  client: PgClient,
  table: string,
): Promise<Record<string, unknown>[]> {
  const result = await client.query(`SELECT * FROM ${table}`);
  return result.rows.map(normalizeRow);
}

async function fetchRecent(
  client: PgClient,
  table: string,
  limit: number,
  orderColumn: string,
): Promise<Record<string, unknown>[]> {
  const result = await client.query(
    `SELECT * FROM ${table} ORDER BY ${orderColumn} DESC NULLS LAST LIMIT $1`,
    [limit],
  );
  return result.rows.map(normalizeRow);
}

async function fetchByIds(
  client: PgClient,
  table: string,
  column: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) {
    return [];
  }
  const result = await client.query(
    `SELECT * FROM ${table} WHERE ${column} = ANY($1::uuid[])`,
    [ids],
  );
  return result.rows.map(normalizeRow);
}

function mergeRowsById(
  ...groups: Record<string, unknown>[][]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const rows of groups) {
    for (const row of rows) {
      byId.set(row.id as string, row);
    }
  }
  return [...byId.values()];
}

async function fetchQualityInspectionsByMonthAndService(
  client: PgClient,
): Promise<Record<string, unknown>[]> {
  const result = await client.query(
    `
      WITH labeled AS (
        SELECT
          i.*,
          to_char(
            timezone('America/Sao_Paulo', COALESCE(i.finalized_at, i.created_at)),
            'YYYY-MM'
          ) AS seed_month,
          UPPER(TRIM(COALESCE(
            NULLIF(checklist_sector.name, ''),
            NULLIF(service_order_sector.name, ''),
            NULLIF(i.service_description, ''),
            'SEM_SERVICO'
          ))) AS service_label
        FROM inspections i
        LEFT JOIN checklists checklist ON checklist.id = i.checklist_id
        LEFT JOIN sectors checklist_sector ON checklist_sector.id = checklist.sector_id
        LEFT JOIN service_orders service_order ON service_order.id = i.service_order_id
        LEFT JOIN sectors service_order_sector ON service_order_sector.id = service_order.sector_id
        WHERE i.status IN ('FINALIZADA', 'PENDENTE_AJUSTE', 'RESOLVIDA')
          AND i.module <> 'SEGURANCA_TRABALHO'
          AND COALESCE(i.finalized_at, i.created_at) >= (
            date_trunc('month', timezone('America/Sao_Paulo', now()))
            - (($1::int - 1) * interval '1 month')
          )
      ),
      ranked AS (
        SELECT id, seed_month, service_label,
          ROW_NUMBER() OVER (
            PARTITION BY seed_month, service_label
            ORDER BY COALESCE(finalized_at, created_at) DESC NULLS LAST
          ) AS rn
        FROM labeled
        WHERE service_label = ANY($2::text[])
      )
      SELECT id FROM ranked WHERE rn <= $3
    `,
    [
      SEED_INSPECTION_MONTHS,
      [...QUALITY_SEED_SERVICES],
      SEED_INSPECTIONS_PER_MONTH_PER_SERVICE,
    ],
  );
  const ids = uniqueIds(result.rows.map((row) => row.id as string));
  return fetchByIds(client, 'inspections', 'id', ids);
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function tablePayload(
  columns: SnapshotColumn[],
  rows: Record<string, unknown>[],
  truncated: boolean,
): SnapshotTable {
  return { columns, rows, truncated };
}

export async function dumpFromPrd(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL_PRD?.trim();
  if (!databaseUrl) {
    throw new Error(
      'Defina DATABASE_URL_PRD no .env com a connection string de produção.',
    );
  }
  assertDumpSourceIsRemote(databaseUrl);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query('SET default_transaction_read_only = on');
  console.log('→ Conectado ao banco de produção (somente leitura)');

  try {
    const snapshot: PrdSnapshot = {
      generatedAt: new Date().toISOString(),
      limit: SEED_ROW_LIMIT,
      tables: {},
    };

    const columnCache = new Map<string, SnapshotColumn[]>();
    const columnsOf = async (table: string) => {
      if (!columnCache.has(table)) {
        columnCache.set(table, await getColumns(client, table));
      }
      return columnCache.get(table)!;
    };

    for (const table of FULL_COPY_TABLES) {
      const rows = await fetchAll(client, table);
      snapshot.tables[table] = tablePayload(await columnsOf(table), rows, false);
      console.log(`✓ ${table}: ${rows.length} (completo)`);
    }

    const qualityInspections = await fetchQualityInspectionsByMonthAndService(
      client,
    );
    const safetyResult = await client.query(
      `
        SELECT * FROM inspections
        WHERE module = 'SEGURANCA_TRABALHO'
        ORDER BY COALESCE(finalized_at, created_at) DESC NULLS LAST
        LIMIT $1
      `,
      [SEED_SAFETY_INSPECTION_LIMIT],
    );
    const inspections = mergeRowsById(
      qualityInspections,
      safetyResult.rows.map(normalizeRow),
    );
    const expectedQualityCap =
      SEED_INSPECTION_MONTHS *
      QUALITY_SEED_SERVICES.length *
      SEED_INSPECTIONS_PER_MONTH_PER_SERVICE;
    snapshot.tables.inspections = tablePayload(
      await columnsOf('inspections'),
      inspections,
      qualityInspections.length >= expectedQualityCap,
    );
    console.log(
      `✓ inspections: ${inspections.length} (${qualityInspections.length} qualidade nos últimos ${SEED_INSPECTION_MONTHS} meses por setor + segurança)`,
    );

    const inspectionIds = uniqueIds(
      inspections.map((row) => row.id as string),
    );
    const referencedServiceOrderIds = uniqueIds(
      inspections.map((row) => row.service_order_id as string | null),
    );

    const recentServiceOrders = await fetchRecent(
      client,
      'service_orders',
      SEED_ROW_LIMIT,
      'created_at',
    );
    const referencedServiceOrders = await fetchByIds(
      client,
      'service_orders',
      'id',
      referencedServiceOrderIds,
    );
    const serviceOrdersById = new Map<string, Record<string, unknown>>();
    for (const row of [...recentServiceOrders, ...referencedServiceOrders]) {
      serviceOrdersById.set(row.id as string, row);
    }
    const serviceOrders = [...serviceOrdersById.values()];
    snapshot.tables.service_orders = tablePayload(
      await columnsOf('service_orders'),
      serviceOrders,
      recentServiceOrders.length >= SEED_ROW_LIMIT,
    );
    console.log(
      `✓ service_orders: ${serviceOrders.length} (${SEED_ROW_LIMIT} recentes + referenciadas pelas vistorias)`,
    );

    const childTables: Array<{
      table: string;
      column: string;
      ids: string[];
    }> = [
      {
        table: 'inspection_collaborators',
        column: 'inspection_id',
        ids: inspectionIds,
      },
      { table: 'inspection_items', column: 'inspection_id', ids: inspectionIds },
      { table: 'evidences', column: 'inspection_id', ids: inspectionIds },
      { table: 'signatures', column: 'inspection_id', ids: inspectionIds },
      {
        table: 'pending_adjustments',
        column: 'inspection_id',
        ids: inspectionIds,
      },
    ];

    for (const child of childTables) {
      const rows = await fetchByIds(client, child.table, child.column, child.ids);
      snapshot.tables[child.table] = tablePayload(
        await columnsOf(child.table),
        rows,
        false,
      );
      console.log(
        `✓ ${child.table}: ${rows.length} (filhos das ${inspectionIds.length} vistorias)`,
      );
    }

    const reportRecords = await fetchRecent(
      client,
      'report_records',
      SEED_ROW_LIMIT,
      'created_at',
    );
    snapshot.tables.report_records = tablePayload(
      await columnsOf('report_records'),
      reportRecords,
      reportRecords.length >= SEED_ROW_LIMIT,
    );
    console.log(`✓ report_records: ${reportRecords.length}`);

    const reportRecordIds = uniqueIds(
      reportRecords.map((row) => row.id as string),
    );
    const reportFiles = await fetchByIds(
      client,
      'report_files',
      'report_record_id',
      reportRecordIds,
    );
    snapshot.tables.report_files = tablePayload(
      await columnsOf('report_files'),
      reportFiles,
      false,
    );
    console.log(`✓ report_files: ${reportFiles.length}`);

    const outputPath = path.resolve(process.cwd(), SNAPSHOT_RELATIVE_PATH);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(snapshot));
    console.log(`\nSnapshot gravado em ${SNAPSHOT_RELATIVE_PATH}`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  dumpFromPrd().catch((error) => {
    console.error('Erro ao gerar dump de PRD:', error);
    process.exit(1);
  });
}
