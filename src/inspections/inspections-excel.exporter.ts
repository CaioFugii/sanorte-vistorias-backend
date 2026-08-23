import { Injectable } from '@nestjs/common';
import {
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  ModuleType,
} from '../common/enums';
import { ExcelService } from '../excel/excel.service';
import { ExcelFile } from '../excel/excel.types';
import { InspectionListItemDto } from './dto/inspection-list-item.dto';
import { InspectionListFilters } from './dto/inspection-list-filters';
import { InspectionsService } from './inspections.service';

const MODULE_LABELS: Partial<Record<ModuleType, string>> = {
  [ModuleType.CAMPO]: 'Campo',
  [ModuleType.REMOTO]: 'Remoto',
  [ModuleType.POS_OBRA]: 'Pós-Obra',
  [ModuleType.SEGURANCA_TRABALHO]: 'Segurança do Trabalho',
  [ModuleType.OBRAS_INVESTIMENTO]: 'Obras de Investimento',
};

const STATUS_LABELS: Record<InspectionStatus, string> = {
  [InspectionStatus.RASCUNHO]: 'Rascunho',
  [InspectionStatus.FINALIZADA]: 'Finalizada',
  [InspectionStatus.PENDENTE_AJUSTE]: 'Pendente Ajuste',
  [InspectionStatus.RESOLVIDA]: 'Resolvida',
};

@Injectable()
export class InspectionsExcelExporter {
  static readonly MAX_EXPORT_ROWS = 5000;

  constructor(
    private readonly inspectionsService: InspectionsService,
    private readonly excelService: ExcelService,
  ) {}

  async export(
    filters: InspectionListFilters,
    userScope?: unknown,
  ): Promise<ExcelFile> {
    const rows = await this.inspectionsService.findForExport(
      filters,
      InspectionsExcelExporter.MAX_EXPORT_ROWS,
      userScope,
    );

    return this.excelService.build({
      filename: `vistorias-${this.todayInSaoPaulo()}.xlsx`,
      sheets: [
        {
          name: 'Vistorias',
          rows,
          columns: [
            {
              header: 'Módulo',
              width: 28,
              value: (row: InspectionListItemDto) => this.moduleLabel(row),
            },
            {
              header: 'OS / Obra',
              width: 22,
              value: (row) =>
                row.serviceOrder?.osNumber ||
                row.investmentWork?.workName ||
                '',
            },
            {
              header: 'Descrição do serviço',
              width: 36,
              value: (row) => row.serviceDescription,
            },
            {
              header: 'Serviço',
              width: 22,
              value: (row) => row.serviceOrder?.resultado,
            },
            {
              header: 'Data de execução',
              width: 16,
              value: (row) => this.formatDate(row.serviceOrder?.fimExecucao),
            },
            {
              header: 'Equipe',
              width: 22,
              value: (row) => row.team?.name,
            },
            {
              header: 'Localização',
              width: 28,
              value: (row) => row.locationDescription,
            },
            {
              header: 'Status',
              width: 18,
              value: (row) => STATUS_LABELS[row.status] ?? row.status,
            },
            {
              header: 'Percentual',
              width: 12,
              value: (row) => row.scorePercent,
            },
            {
              header: 'Data da vistoria',
              width: 16,
              value: (row) =>
                this.formatDate(row.finalizedAt ?? row.createdAt),
            },
          ],
        },
      ],
    });
  }

  private moduleLabel(row: InspectionListItemDto): string {
    const base = MODULE_LABELS[row.module] ?? row.module;
    if (
      row.module !== ModuleType.OBRAS_INVESTIMENTO ||
      !row.evaluationModule
    ) {
      return base;
    }
    const typeLabel =
      row.evaluationModule === InvestmentWorkEvaluationModule.CAMPO
        ? 'Campo'
        : 'Pós-obra';
    return `${base} (${typeLabel})`;
  }

  private formatDate(value?: Date | string | null): string {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  }

  private todayInSaoPaulo(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
  }
}
