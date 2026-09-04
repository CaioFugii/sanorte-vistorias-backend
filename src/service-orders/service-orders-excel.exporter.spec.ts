import { ExcelService } from '../excel/excel.service';
import { ServiceOrdersExcelExporter } from './service-orders-excel.exporter';
import * as XLSX from 'xlsx';

describe('ServiceOrdersExcelExporter', () => {
  const excelService = new ExcelService();
  const serviceOrdersService = {
    findForExport: jest.fn(),
    findContractName: jest.fn(),
  };
  const exporter = new ServiceOrdersExcelExporter(
    serviceOrdersService as any,
    excelService,
  );

  beforeEach(() => {
    serviceOrdersService.findForExport.mockReset();
    serviceOrdersService.findContractName.mockReset();
    serviceOrdersService.findForExport.mockResolvedValue([
      {
        osNumber: '26100010434',
        address: 'RUA CASTEL NUOVO - 108 - VL MARGARIDA',
        field: false,
        remote: true,
        postWork: false,
        status: 'Fechada',
        equipe: 'ROBSON DA SILVA',
        fimExecucao: new Date('2026-08-11T17:49:00.000Z'),
        tempoExecucaoEfetivo: '+00 03:55:00',
        resultado: 'REPARO DE REDE DE AGUA',
        updatedAt: new Date('2026-08-12T13:27:00.000Z'),
        sector: { name: 'AGUA' },
      },
    ]);
    serviceOrdersService.findContractName.mockResolvedValue(null);
  });

  it('exporta OS no layout do modelo com os dados existentes', async () => {
    const file = await exporter.export(
      { from: '2026-08-05', to: '2026-09-04' },
      { role: 'ADMIN' },
    );

    expect(serviceOrdersService.findForExport).toHaveBeenCalledWith(
      { role: 'ADMIN' },
      { from: '2026-08-05', to: '2026-09-04' },
      ServiceOrdersExcelExporter.MAX_EXPORT_ROWS,
    );
    expect(file.filename).toMatch(/^ordens-de-servico-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['O.S']);
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(
      workbook.Sheets['O.S'],
      { header: 1 },
    );

    expect(rows[0]?.[0]).toBe('ORDENS DE SERVIÇOS CADASTRADAS');
    expect(rows[1]?.[0]).toBe(
      'PERÍODO: 05/08/2026 A 04/09/2026    CONTRATO: TODOS',
    );
    expect(rows[2]).toEqual([
      'Número da OS',
      'Setor',
      'Endereço',
      'Campo',
      'Remota',
      'Pós-obra',
      'Status',
      'Equipe PDA',
      'Fim execução',
      'Tempo execução efetivo',
      'Resultado',
      'Atualizada/Inserida em',
    ]);
    expect(String(rows[3]?.[0])).toBe('26100010434');
    expect(rows[3]?.[1]).toBe('AGUA');
    expect(rows[3]?.[3]).toBe('Não');
    expect(rows[3]?.[4]).toBe('Sim');
    expect(rows[3]?.[7]).toBe('ROBSON DA SILVA');
    expect(rows[3]?.[10]).toBe('REPARO DE REDE DE AGUA');
    expect(rows[2]?.includes('Equipe Real')).toBe(false);
  });

  it('usa o nome do contrato filtrado no cabeçalho', async () => {
    serviceOrdersService.findContractName.mockResolvedValue('SÃO VICENTE - SP');

    const file = await exporter.export({
      from: '2026-08-05',
      to: '2026-09-04',
      contractId: 'contract-1',
    });

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(
      workbook.Sheets['O.S'],
      { header: 1 },
    );
    expect(rows[1]?.[0]).toBe(
      'PERÍODO: 05/08/2026 A 04/09/2026    CONTRATO: SÃO VICENTE - SP',
    );
  });
});
