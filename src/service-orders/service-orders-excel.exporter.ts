import { Injectable } from '@nestjs/common';
import { ExcelService } from '../excel/excel.service';
import { ExcelCellValue, ExcelFile } from '../excel/excel.types';
import { ServiceOrder } from '../entities';
import { ServiceOrdersService } from './service-orders.service';

export type ServiceOrdersExportFilters = {
  osNumber?: string;
  contractId?: string;
  from?: string;
  to?: string;
  sectorId?: string;
  field?: boolean;
  remote?: boolean;
  postWork?: boolean;
  equipe?: string;
  resultado?: string;
};

@Injectable()
export class ServiceOrdersExcelExporter {
  static readonly MAX_EXPORT_ROWS = 5000;

  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly excelService: ExcelService,
  ) {}

  async export(
    filters: ServiceOrdersExportFilters,
    user?: unknown,
  ): Promise<ExcelFile> {
    const [rows, contractName] = await Promise.all([
      this.serviceOrdersService.findForExport(
        user,
        filters,
        ServiceOrdersExcelExporter.MAX_EXPORT_ROWS,
      ),
      this.serviceOrdersService.findContractName(filters.contractId),
    ]);
    const today = this.todayInSaoPaulo();

    return this.excelService.buildFromGrid({
      filename: `ordens-de-servico-${today}.xlsx`,
      sheets: [
        {
          name: 'O.S',
          cols: [
            { wch: 18 },
            { wch: 16 },
            { wch: 48 },
            { wch: 10 },
            { wch: 10 },
            { wch: 12 },
            { wch: 14 },
            { wch: 28 },
            { wch: 20 },
            { wch: 22 },
            { wch: 36 },
            { wch: 22 },
          ],
          merges: [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
          ],
          rows: [
            ['ORDENS DE SERVIÇOS CADASTRADAS'],
            [this.periodLabel(filters.from, filters.to, contractName)],
            [
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
            ],
            ...rows.map((row) => this.toDataRow(row)),
          ],
        },
      ],
    });
  }

  private toDataRow(row: ServiceOrder): ExcelCellValue[] {
    return [
      row.osNumber,
      row.sector?.name ?? '',
      row.address,
      this.booleanLabel(row.field),
      this.booleanLabel(row.remote),
      this.booleanLabel(row.postWork),
      row.status ?? '',
      row.equipe ?? '',
      this.formatDateTime(row.fimExecucao),
      row.tempoExecucaoEfetivo ?? '',
      row.resultado ?? '',
      this.formatDateTime(row.updatedAt),
    ];
  }

  private booleanLabel(value?: boolean): string {
    return value ? 'Sim' : 'Não';
  }

  private periodLabel(
    from?: string,
    to?: string,
    contractName?: string | null,
  ): string {
    const fromLabel = this.formatIsoDate(from);
    const toLabel = this.formatIsoDate(to);
    const contract = contractName?.trim() || 'TODOS';
    return `PERÍODO: ${fromLabel} A ${toLabel}    CONTRATO: ${contract}`;
  }

  private formatIsoDate(value?: string): string {
    if (!value) {
      return '';
    }
    const [year, month, day] = value.split('T')[0]?.split('-') ?? [];
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  }

  private formatDateTime(value?: Date | string | null): string {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private todayInSaoPaulo(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
  }
}
