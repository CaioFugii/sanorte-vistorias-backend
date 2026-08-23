import { InspectionStatus, ModuleType } from '../common/enums';
import { ExcelService } from '../excel/excel.service';
import { InspectionsExcelExporter } from './inspections-excel.exporter';

describe('InspectionsExcelExporter', () => {
  const excelService = new ExcelService();
  const inspectionsService = {
    findForExport: jest.fn(),
  };
  const exporter = new InspectionsExcelExporter(
    inspectionsService as any,
    excelService,
  );

  beforeEach(() => {
    inspectionsService.findForExport.mockReset();
  });

  it('monta planilha com os filtros e o limite padrão', async () => {
    inspectionsService.findForExport.mockResolvedValue([
      {
        externalId: 'ext-1',
        module: ModuleType.CAMPO,
        evaluationModule: null,
        serviceDescription: 'Ligação predial',
        locationDescription: 'Rua A',
        status: InspectionStatus.FINALIZADA,
        scorePercent: 91.5,
        hasParalysisPenalty: false,
        finalizedAt: new Date('2026-08-20T15:00:00.000Z'),
        createdAt: new Date('2026-08-19T15:00:00.000Z'),
        team: { name: 'Equipe A' },
        serviceOrder: {
          osNumber: 'OS-100',
          fimExecucao: new Date('2026-08-18T15:00:00.000Z'),
          resultado: 'REPOSICAO',
        },
        investmentWork: null,
      },
    ]);

    const file = await exporter.export(
      { module: ModuleType.CAMPO, status: InspectionStatus.FINALIZADA },
      { role: 'ADMIN' },
    );

    expect(inspectionsService.findForExport).toHaveBeenCalledWith(
      { module: ModuleType.CAMPO, status: InspectionStatus.FINALIZADA },
      InspectionsExcelExporter.MAX_EXPORT_ROWS,
      { role: 'ADMIN' },
    );
    expect(file.filename).toMatch(/^vistorias-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(file.buffer.length).toBeGreaterThan(0);
  });
});
