import { ExcelService } from '../excel/excel.service';
import { QualityRankingExcelExporter } from './quality-ranking-excel.exporter';
import * as XLSX from 'xlsx';

describe('QualityRankingExcelExporter', () => {
  const excelService = new ExcelService();
  const dashboardsService = {
    getTeamsRankingForExport: jest.fn(),
  };
  const exporter = new QualityRankingExcelExporter(
    dashboardsService as any,
    excelService,
  );

  beforeEach(() => {
    dashboardsService.getTeamsRankingForExport.mockReset();
    dashboardsService.getTeamsRankingForExport.mockResolvedValue([
      {
        teamId: 'team-1',
        teamName: 'JONATAS SILVA',
        teamType: 'EMPREITEIRO',
        segment: 'AGUA',
        averagePercent: 83.9,
        inspectionsCount: 195,
        remotePercent: 83.9,
        remoteInspectionsCount: 195,
        fieldPercent: 0,
        fieldInspectionsCount: 0,
        postWorkPercent: 0,
        postWorkInspectionsCount: 0,
        pendingCount: 0,
        investmentWorksPercent: 0,
      },
      {
        teamId: 'team-2',
        teamName: 'JOSE ANDRADE',
        teamType: 'PRÓPRIA',
        segment: 'AGUA',
        averagePercent: 63.22,
        inspectionsCount: 84,
        remotePercent: 64.49,
        remoteInspectionsCount: 78,
        fieldPercent: 0,
        fieldInspectionsCount: 0,
        postWorkPercent: 61.95,
        postWorkInspectionsCount: 6,
        pendingCount: 1,
        investmentWorksPercent: 0,
      },
    ]);
  });

  it('exporta ranking no layout do modelo com dados existentes', async () => {
    const file = await exporter.export({
      from: '2026-09-01',
      to: '2026-09-04',
      user: { role: 'ADMIN' },
    });

    expect(dashboardsService.getTeamsRankingForExport).toHaveBeenCalledWith({
      from: '2026-09-01',
      to: '2026-09-04',
      user: { role: 'ADMIN' },
      sector: 'QUALITY',
    });
    expect(file.filename).toMatch(/^ranking-qualidade-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    expect(sheetName).toMatch(/^Ranking \d{2}\.\d{2}_\d{2}\.\d{2}$/);

    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(
      workbook.Sheets[sheetName],
      { header: 1 },
    );

    expect(rows[0]?.[0]).toBe(
      'CLASSIFICAÇÃO AVALIATIVA DO DEPARTAMENTO DE QUALIDADE',
    );
    expect(rows[1]?.[0]).toBe('PERÍODO: 01/09/2026 A 04/09/2026');
    expect(String(rows[2]?.[0])).toMatch(/^ATUALIZADO EM /);
    expect(rows[3]?.slice(3, 11)).toEqual([
      'AVALIAÇÃO REMOTA',
      '',
      'AVALIAÇÃO EM CAMPO',
      '',
      'AVALIAÇÃO PÓS OBRA',
      '',
      'MÉDIA FINAL',
      '',
    ]);
    expect(rows[4]).toEqual([
      'EQUIPE',
      'TIPO',
      'SEGMENTO',
      'PORCENTAGEM',
      'VISTORIAS',
      'PORCENTAGEM',
      'VISTORIAS',
      'PORCENTAGEM',
      'VISTORIAS',
      'PORCENTAGEM',
      'VISTORIAS',
    ]);
    expect(rows[5]).toEqual([
      'JONATAS SILVA',
      'EMPREITEIRO',
      'AGUA',
      83.9,
      195,
      '',
      '',
      '',
      '',
      83.9,
      195,
    ]);
    expect(rows[6]).toEqual([
      'JOSE ANDRADE',
      'PRÓPRIA',
      'AGUA',
      64.49,
      78,
      '',
      '',
      61.95,
      6,
      63.22,
      84,
    ]);
  });
});
