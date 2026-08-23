export const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

const INVALID_SHEET_NAME_CHARS = /[[\]:*?/\\]/g;
const INVALID_FILENAME_CHARS = /[/\\?%*:|"<>]/g;

export function sanitizeExcelSheetName(name: string): string {
  const cleaned = name.replace(INVALID_SHEET_NAME_CHARS, ' ').trim() || 'Planilha';
  return cleaned.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
}

export function sanitizeExcelFilename(filename: string): string {
  const trimmed = filename.trim() || 'export.xlsx';
  const withExtension = trimmed.toLowerCase().endsWith('.xlsx')
    ? trimmed
    : `${trimmed}.xlsx`;
  return withExtension.replace(INVALID_FILENAME_CHARS, '-');
}

export function buildExcelContentDisposition(filename: string): string {
  const safeName = sanitizeExcelFilename(filename);
  return `attachment; filename="${safeName}"`;
}
