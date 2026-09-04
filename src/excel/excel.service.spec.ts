import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ExcelService } from './excel.service';

describe('ExcelService', () => {
  const service = new ExcelService();

  it('gera workbook com cabeçalho e linhas', () => {
    const file = service.build({
      filename: 'vistorias.xlsx',
      sheets: [
        {
          name: 'Vistorias',
          columns: [
            {
              header: 'Módulo',
              value: (row: { module: string }) => row.module,
            },
            { header: 'Nota', value: (row: { score: number }) => row.score },
          ],
          rows: [
            { module: 'CAMPO', score: 95.5 },
            { module: 'REMOTO', score: 80 },
          ],
        },
      ],
    });

    expect(file.filename).toBe('vistorias.xlsx');
    expect(file.mimeType).toContain('spreadsheetml');
    expect(file.buffer.length).toBeGreaterThan(0);

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[workbook.SheetNames[0]],
      { header: 1 },
    );
    expect(workbook.SheetNames).toEqual(['Vistorias']);
    expect(rows[0]).toEqual(['Módulo', 'Nota']);
    expect(rows[1]).toEqual(['CAMPO', 95.5]);
    expect(rows[2]).toEqual(['REMOTO', 80]);
  });

  it('mantém cabeçalho quando não há linhas', () => {
    const file = service.build({
      filename: 'vazio',
      sheets: [
        {
          name: 'Vazio',
          columns: [{ header: 'Coluna', value: () => 'x' }],
          rows: [],
        },
      ],
    });

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Vazio, {
      header: 1,
    });
    expect(file.filename).toBe('vazio.xlsx');
    expect(rows).toEqual([['Coluna']]);
  });

  it('normaliza célula vazia e sanitiza nome de aba/arquivo', () => {
    const file = service.build({
      filename: 'relatorio/invalido.xlsx',
      sheets: [
        {
          name: 'Aba:inválida?*',
          columns: [
            {
              header: 'Valor',
              value: (row: { value?: string | null }) => row.value,
            },
          ],
          rows: [{ value: null }, { value: undefined }],
        },
      ],
    });

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    expect(file.filename).toBe('relatorio-invalido.xlsx');
    expect(workbook.SheetNames[0]).toBe('Aba inválida');
    const rows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[workbook.SheetNames[0]],
      { header: 1 },
    );
    expect(rows[1]).toEqual(['']);
    expect(rows[2]).toEqual(['']);
  });

  it('gera workbook a partir de grade com mesclas', () => {
    const file = service.buildFromGrid({
      filename: 'ranking.xlsx',
      sheets: [
        {
          name: 'Ranking',
          rows: [['TÍTULO'], ['EQUIPE', 'TIPO'], ['Equipe A', 'PRÓPRIA']],
          merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }],
          cols: [{ wch: 20 }, { wch: 12 }],
        },
      ],
    });

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets.Ranking;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(file.filename).toBe('ranking.xlsx');
    expect(rows[0]?.[0]).toBe('TÍTULO');
    expect(rows[2]).toEqual(['Equipe A', 'PRÓPRIA']);
    expect(sheet['!merges']?.[0]).toEqual({
      s: { r: 0, c: 0 },
      e: { r: 0, c: 1 },
    });
  });

  it('rejeita spec sem abas ou sem colunas', () => {
    expect(() => service.build({ filename: 'x.xlsx', sheets: [] })).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.build({
        filename: 'x.xlsx',
        sheets: [{ name: 'A', columns: [], rows: [] }],
      }),
    ).toThrow(BadRequestException);
  });
});
