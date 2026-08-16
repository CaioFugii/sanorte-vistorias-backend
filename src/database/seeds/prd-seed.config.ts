export const SEED_ROW_LIMIT = 500;

/** Janela do gráfico de qualidade (mês vigente + 3 anteriores). */
export const SEED_INSPECTION_MONTHS = 4;

/** Amostra por mês e setor (AGUA, DESOBSTRUCAO, ESGOTO, HIDROMETRIA, REPOSICAO). */
export const SEED_INSPECTIONS_PER_MONTH_PER_SERVICE = 50;

export const SEED_SAFETY_INSPECTION_LIMIT = 50;

export const QUALITY_SEED_SERVICES = [
  'AGUA',
  'DESOBSTRUCAO',
  'ESGOTO',
  'HIDROMETRIA',
  'REPOSICAO',
] as const;

export const SNAPSHOT_RELATIVE_PATH = 'src/database/seeds/data/prd-snapshot.json';

export const INSERT_TABLE_ORDER = [
  'users',
  'sectors',
  'contracts',
  'teams',
  'collaborators',
  'user_contracts',
  'team_contracts',
  'team_collaborators',
  'checklists',
  'checklist_sections',
  'checklist_items',
  'service_orders',
  'investment_works',
  'inspections',
  'inspection_collaborators',
  'inspection_items',
  'evidences',
  'signatures',
  'pending_adjustments',
  'report_types',
  'report_type_fields',
  'report_records',
  'report_files',
] as const;

export type SeedTableName = (typeof INSERT_TABLE_ORDER)[number];

export const FULL_COPY_TABLES: SeedTableName[] = [
  'users',
  'sectors',
  'contracts',
  'teams',
  'collaborators',
  'user_contracts',
  'team_contracts',
  'team_collaborators',
  'checklists',
  'checklist_sections',
  'checklist_items',
  'investment_works',
  'report_types',
  'report_type_fields',
];

export type SnapshotColumn = {
  name: string;
  dataType: string;
  udtName: string;
};

export type SnapshotTable = {
  columns: SnapshotColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
};

export type PrdSnapshot = {
  generatedAt: string;
  limit: number;
  tables: Record<string, SnapshotTable>;
};

const MIN_SEED_YEAR = 1970;
const MAX_SEED_YEAR = 2100;

export function isPlausibleSeedDate(value: Date): boolean {
  const year = value.getUTCFullYear();
  return Number.isFinite(year) && year >= MIN_SEED_YEAR && year <= MAX_SEED_YEAR;
}

export function sanitizeSeedTimestamp(value: unknown): unknown {
  if (value instanceof Date) {
    return isPlausibleSeedDate(value) ? value.toISOString() : null;
  }
  if (typeof value === 'string' && /^\+?\d{5,}-\d{2}-\d{2}/.test(value)) {
    return null;
  }
  return value;
}
