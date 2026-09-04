export type ExcelCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export interface ExcelColumn<TRow = unknown> {
  header: string;
  width?: number;
  value: (row: TRow) => ExcelCellValue;
}

export interface ExcelSheetSpec<TRow = unknown> {
  name: string;
  columns: ExcelColumn<TRow>[];
  rows: TRow[];
}

export interface ExcelWorkbookSpec {
  filename: string;
  sheets: ExcelSheetSpec<any>[];
}

export interface ExcelGridSheetSpec {
  name: string;
  rows: ExcelCellValue[][];
  merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  cols?: Array<{ wch: number }>;
}

export interface ExcelGridWorkbookSpec {
  filename: string;
  sheets: ExcelGridSheetSpec[];
}

export interface ExcelFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}
