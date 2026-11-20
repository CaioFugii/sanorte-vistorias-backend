import {
  InspectionExcelLayout,
  InspectionStatus,
  ModuleType,
} from '../common/enums';
import { ExcelService } from '../excel/excel.service';
import { InspectionsExcelExporter } from './inspections-excel.exporter';
import * as XLSX from 'xlsx';

describe('InspectionsExcelExporter', () => {
  const excelService = new ExcelService();
  const inspectionsService = {
    findForExport: jest.fn(),
  };
  const exporter = new InspectionsExcelExporter(
    inspectionsService as any,
    excelService,
  );

  const sampleRow = {
    externalId: 'ext-1',
    module: ModuleType.CAMPO,
    evaluationModule: null,
    serviceDescription: 'Ligação predial',
    locationDescription: 'Rua A',
    status: InspectionStatus.PENDENTE_AJUSTE,
    scorePercent: 91.5,
    hasParalysisPenalty: false,
    finalizedAt: new Date('2026-08-20T15:00:00.000Z'),
    createdAt: new Date('2026-08-19T15:00:00.000Z'),
    team: { name: 'Equipe A' },
    createdBy: { name: 'Fiscal Silva' },
    pendingItemsPreview: ['Vala não requadrada', 'Abatimento'],
    serviceOrder: {
      osNumber: 'OS-100',
      fimExecucao: new Date('2026-08-18T15:00:00.000Z'),
      resultado: 'REPOSICAO',
    },
    investmentWork: null,
  };

  beforeEach(() => {
    inspectionsService.findForExport.mockReset();
    inspectionsService.findForExport.mockResolvedValue([sampleRow]);
  });

  it('exporta avaliações com fiscal, endereço e NCs', async () => {
    const file = await exporter.export(
      { module: ModuleType.CAMPO },
      { role: 'ADMIN' },
      InspectionExcelLayout.AVALIACOES,
    );

    expect(inspectionsService.findForExport).toHaveBeenCalledWith(
      { module: ModuleType.CAMPO },
      InspectionsExcelExporter.MAX_EXPORT_ROWS,
      { role: 'ADMIN' },
    );
    expect(file.filename).toMatch(
      /^vistorias-qualidade-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['Avaliações']);
    const rows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets.Avaliações,
      { header: 1 },
    );
    expect(rows[0]).toEqual([
      'Módulo',
      'Fiscal',
      'OS / Obra',
      'Contrato',
      'Descrição',
      'Serviço',
      'Data de execução',
      'Equipe',
      'Endereço',
      'Status',
      'Percentual',
      'Data da vistoria',
      'NC 1',
      'NC 2',
      'NC 3',
      'NC 4',
      'NC 5',
      'NC 6',
      'NC 7',
      'NC 8',
    ]);
    expect(rows[1]?.[1]).toBe('Fiscal Silva');
    expect(rows[1]?.[8]).toBe('Rua A');
    expect(rows[1]?.[12]).toBe('Vala não requadrada');
    expect(rows[1]?.[13]).toBe('Abatimento');
  });

  it('exporta pendências com localização e equipe na ordem da tela', async () => {
    const file = await exporter.export(
      { status: InspectionStatus.PENDENTE_AJUSTE },
      { role: 'ADMIN' },
      InspectionExcelLayout.PENDENCIAS,
    );

    expect(file.filename).toMatch(
      /^pendencias-ajuste-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['Pendências']);
    const rows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets['Pendências'],
      { header: 1 },
    );
    expect(rows[0]?.slice(0, 8)).toEqual([
      'Módulo',
      'OS / Obra',
      'Descrição do serviço',
      'Serviço',
      'Data de execução',
      'Localização',
      'Equipe',
      'Status',
    ]);
    expect(rows[1]?.[5]).toBe('Rua A');
    expect(rows[1]?.[6]).toBe('Equipe A');
  });

  it('avaliações trazem Contrato e a data da obra quando não há OS', async () => {
    inspectionsService.findForExport.mockResolvedValue([
      {
        ...sampleRow,
        serviceOrder: null,
        contract: { id: 'contract-1', name: 'Contrato Norte' },
        investmentWork: {
          id: 'work-1',
          name: '17219247782',
          workName: '17219247782',
          origin: 'IMPORT',
          executionDate: '2026-10-20',
        },
      },
    ]);

    const file = await exporter.export(
      { contractId: 'contract-1' },
      { role: 'ADMIN' },
      InspectionExcelLayout.AVALIACOES,
    );

    expect(inspectionsService.findForExport).toHaveBeenCalledWith(
      { contractId: 'contract-1' },
      InspectionsExcelExporter.MAX_EXPORT_ROWS,
      { role: 'ADMIN' },
    );
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets.Avaliações,
      { header: 1 },
    );
    expect(rows[0]?.[2]).toBe('OS / Obra');
    expect(rows[0]?.[3]).toBe('Contrato');
    expect(rows[1]?.[2]).toBe('17219247782');
    expect(rows[1]?.[3]).toBe('Contrato Norte');
    expect(rows[1]?.[6]).toBe('20/10/2026');
  });
});
