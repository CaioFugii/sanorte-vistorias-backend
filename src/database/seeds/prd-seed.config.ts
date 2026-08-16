export const SEED_ROW_LIMIT = 500;

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
