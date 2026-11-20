import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { normalizeServiceResult } from '../../service-orders/post-work-eligibility';

export interface ParsedInvestmentWorkRow {
  lineNumber: number;
  osNumber: string | null;
  osError: string | null;
  executionDate: string | null;
  dateError: string | null;
  description: string;
  descriptionKey: string;
  address: string;
  district: string;
  pdaTeam: string;
  rawRow: Record<string, string>;
}

const COLUMNS = [
  { field: 'os', label: 'O.S', names: ['O.S', 'OS'] },
  { field: 'date', label: 'data', names: ['DATA'] },
  { field: 'description', label: 'Descrição', names: ['DESCRICAO'] },
  { field: 'address', label: 'Endereço', names: ['ENDERECO'] },
  { field: 'district', label: 'Bairro', names: ['BAIRRO'] },
  { field: 'pdaTeam', label: 'Equipe PDA', names: ['EQUIPE PDA'] },
] as const;

type Field = (typeof COLUMNS)[number]['field'];

@Injectable()
export class InvestmentWorkImportParserService {
  parse(buffer: Buffer): ParsedInvestmentWorkRow[] {
    const sheet = this.readSheet(buffer);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    const header = (matrix[0] ?? []).map((cell) => this.cellText(cell));
    const indexes = this.columnIndexes(header);
    return matrix
      .slice(1)
      .map((row, index) => this.parseRow(row, index + 2, indexes, header));
  }

  private readSheet(buffer: Buffer): XLSX.WorkSheet {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    } catch {
      throw new BadRequestException('Arquivo inválido');
    }
    const name = workbook.SheetNames[0];
    const sheet = name ? workbook.Sheets[name] : undefined;
    if (!sheet) {
      throw new BadRequestException('Arquivo inválido');
    }
    return sheet;
  }

  private columnIndexes(header: string[]): Record<Field, number> {
    const normalized = header.map((value) => this.headerKey(value));
    const missing: string[] = [];
    const indexes = {} as Record<Field, number>;
    for (const column of COLUMNS) {
      const at = normalized.findIndex((name) =>
        (column.names as readonly string[]).includes(name),
      );
      if (at < 0) {
        missing.push(column.label);
      } else {
        indexes[column.field] = at;
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Colunas ausentes: ${missing.join(', ')}`);
    }
    return indexes;
  }

  private parseRow(
    row: unknown,
    lineNumber: number,
    indexes: Record<Field, number>,
    header: string[],
  ): ParsedInvestmentWorkRow {
    const cells = Array.isArray(row) ? row : [];
    const rawRow: Record<string, string> = {};
    header.forEach((name, index) => {
      if (name.trim()) {
        rawRow[name] = this.cellText(cells[index]);
      }
    });
    const os = this.parseOs(cells[indexes.os]);
    const date = this.parseDate(cells[indexes.date]);
    const description = this.cellText(cells[indexes.description]).trim();
    return {
      lineNumber,
      osNumber: os.value,
      osError: os.error,
      executionDate: date.value,
      dateError: date.error,
      description,
      descriptionKey: normalizeServiceResult(description),
      address: this.cellText(cells[indexes.address]).trim(),
      district: this.cellText(cells[indexes.district]).trim(),
      pdaTeam: this.cellText(cells[indexes.pdaTeam]).trim(),
      rawRow,
    };
  }

  private parseOs(value: unknown): {
    value: string | null;
    error: string | null;
  } {
    if (value === null || value === undefined || value === '') {
      return { value: null, error: 'O.S ausente' };
    }
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value < 0) {
        return { value: null, error: 'O.S acima do limite seguro' };
      }
      return { value: String(value), error: null };
    }
    const text = this.cellText(value).trim();
    if (!text) {
      return { value: null, error: 'O.S ausente' };
    }
    return { value: text, error: null };
  }

  private parseDate(value: unknown): {
    value: string | null;
    error: string | null;
  } {
    if (value === null || value === undefined || value === '') {
      return { value: null, error: 'data ausente' };
    }
    if (typeof value === 'number') {
      const iso = this.excelSerialToIso(value);
      return iso
        ? { value: iso, error: null }
        : { value: null, error: 'data inválida' };
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return { value: null, error: 'data inválida' };
      }
      const iso = this.calendarIso(
        value.getFullYear(),
        value.getMonth() + 1,
        value.getDate(),
      );
      return iso
        ? { value: iso, error: null }
        : { value: null, error: 'data inválida' };
    }
    const text = this.cellText(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const iso = this.calendarIso(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3]),
      );
      return iso
        ? { value: iso, error: null }
        : { value: null, error: 'data inválida' };
    }
    const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      const iso = this.calendarIso(
        Number(brMatch[3]),
        Number(brMatch[2]),
        Number(brMatch[1]),
      );
      return iso
        ? { value: iso, error: null }
        : { value: null, error: 'data inválida' };
    }
    return { value: null, error: 'data inválida' };
  }

  private excelSerialToIso(serial: number): string | null {
    if (!Number.isFinite(serial)) {
      return null;
    }
    const whole = Math.floor(serial);
    if (whole <= 0) {
      return null;
    }
    const utc = new Date(Date.UTC(1899, 11, 30) + whole * 86_400_000);
    return this.calendarIso(
      utc.getUTCFullYear(),
      utc.getUTCMonth() + 1,
      utc.getUTCDate(),
    );
  }

  private calendarIso(year: number, month: number, day: number): string | null {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    const monthText = String(month).padStart(2, '0');
    const dayText = String(day).padStart(2, '0');
    return `${year}-${monthText}-${dayText}`;
  }

  private headerKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private cellText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }
}
