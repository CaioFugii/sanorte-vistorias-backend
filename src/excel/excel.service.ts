import {
  BadRequestException,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import {
  EXCEL_MIME_TYPE,
  buildExcelContentDisposition,
  sanitizeExcelFilename,
  sanitizeExcelSheetName,
} from './excel.constants';
import {
  ExcelCellValue,
  ExcelFile,
  ExcelGridWorkbookSpec,
  ExcelWorkbookSpec,
} from './excel.types';

@Injectable()
export class ExcelService {
  build(spec: ExcelWorkbookSpec): ExcelFile {
    if (!spec.sheets?.length) {
      throw new BadRequestException(
        'A planilha precisa de pelo menos uma aba para ser gerada.',
      );
    }

    const workbook = XLSX.utils.book_new();
    const usedNames = new Set<string>();

    for (const sheet of spec.sheets) {
      if (!sheet.columns?.length) {
        throw new BadRequestException(
          `A aba "${sheet.name}" precisa de pelo menos uma coluna.`,
        );
      }

      const header = sheet.columns.map((column) => column.header);
      const dataRows = sheet.rows.map((row) =>
        sheet.columns.map((column) => this.normalizeCell(column.value(row))),
      );
      const worksheet = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
      worksheet['!cols'] = sheet.columns.map((column) => ({
        wch: column.width ?? Math.max(column.header.length + 2, 14),
      }));

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        this.uniqueSheetName(sheet.name, usedNames),
      );
    }

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    return {
      filename: sanitizeExcelFilename(spec.filename),
      mimeType: EXCEL_MIME_TYPE,
      buffer,
    };
  }

  buildFromGrid(spec: ExcelGridWorkbookSpec): ExcelFile {
    if (!spec.sheets?.length) {
      throw new BadRequestException(
        'A planilha precisa de pelo menos uma aba para ser gerada.',
      );
    }

    const workbook = XLSX.utils.book_new();
    const usedNames = new Set<string>();

    for (const sheet of spec.sheets) {
      if (!sheet.rows?.length) {
        throw new BadRequestException(
          `A aba "${sheet.name}" precisa de pelo menos uma linha.`,
        );
      }

      const normalizedRows = sheet.rows.map((row) =>
        row.map((cell) => this.normalizeCell(cell)),
      );
      const worksheet = XLSX.utils.aoa_to_sheet(normalizedRows);
      if (sheet.cols?.length) {
        worksheet['!cols'] = sheet.cols;
      }
      if (sheet.merges?.length) {
        worksheet['!merges'] = sheet.merges;
      }

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        this.uniqueSheetName(sheet.name, usedNames),
      );
    }

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    return {
      filename: sanitizeExcelFilename(spec.filename),
      mimeType: EXCEL_MIME_TYPE,
      buffer,
    };
  }

  attachToResponse(file: ExcelFile, res: Response): StreamableFile {
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      buildExcelContentDisposition(file.filename),
    );
    return new StreamableFile(file.buffer);
  }

  private uniqueSheetName(name: string, usedNames: Set<string>): string {
    let candidate = sanitizeExcelSheetName(name);
    let suffix = 2;
    while (usedNames.has(candidate)) {
      const base = sanitizeExcelSheetName(name).slice(0, 28);
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  }

  private normalizeCell(value: ExcelCellValue): string | number | boolean {
    if (value == null) {
      return '';
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }
    return value;
  }
}
