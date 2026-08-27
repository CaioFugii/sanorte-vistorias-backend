import { Injectable } from '@nestjs/common';
import {
  InspectionExcelLayout,
  InspectionStatus,
  InvestmentWorkEvaluationModule,
  ModuleType,
} from '../common/enums';
import { ExcelService } from '../excel/excel.service';
import { ExcelColumn, ExcelFile } from '../excel/excel.types';
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

const NC_COLUMN_COUNT = 8;

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
    layout: InspectionExcelLayout = InspectionExcelLayout.AVALIACOES,
  ): Promise<ExcelFile> {
    const rows = await this.inspectionsService.findForExport(
      filters,
      InspectionsExcelExporter.MAX_EXPORT_ROWS,
      userScope,
    );
    const isPendencias = layout === InspectionExcelLayout.PENDENCIAS;
    const today = this.todayInSaoPaulo();

    return this.excelService.build({
      filename: isPendencias
        ? `pendencias-ajuste-${today}.xlsx`
        : `vistorias-qualidade-${today}.xlsx`,
      sheets: [
        {
          name: isPendencias ? 'Pendências' : 'Avaliações',
          rows,
          columns: this.columnsFor(layout),
        },
      ],
    });
  }

  private columnsFor(
    layout: InspectionExcelLayout,
  ): ExcelColumn<InspectionListItemDto>[] {
    const isPendencias = layout === InspectionExcelLayout.PENDENCIAS;
    const locationHeader = isPendencias ? 'Localização' : 'Endereço';
    const descriptionHeader = isPendencias
      ? 'Descrição do serviço'
      : 'Descrição';

    const columns: ExcelColumn<InspectionListItemDto>[] = [
      {
        header: 'Módulo',
        width: 28,
        value: (row) => this.moduleLabel(row),
      },
    ];

    if (!isPendencias) {
      columns.push({
        header: 'Fiscal',
        width: 28,
        value: (row) => row.createdBy?.name,
      });
    }

    columns.push(
      {
        header: 'OS / Obra',
        width: 22,
        value: (row) =>
          row.serviceOrder?.osNumber || row.investmentWork?.workName || '',
      },
      {
        header: descriptionHeader,
        width: 36,
        value: (row) => row.serviceDescription,
      },
      {
        header: 'Serviço',
        width: 28,
        value: (row) => row.serviceOrder?.resultado,
      },
      {
        header: 'Data de execução',
        width: 20,
        value: (row) => this.formatDateTime(row.serviceOrder?.fimExecucao),
      },
    );

    if (isPendencias) {
      columns.push(
        {
          header: locationHeader,
          width: 40,
          value: (row) => row.locationDescription,
        },
        {
          header: 'Equipe',
          width: 24,
          value: (row) => row.team?.name,
        },
      );
    } else {
      columns.push(
        {
          header: 'Equipe',
          width: 24,
          value: (row) => row.team?.name,
        },
        {
          header: locationHeader,
          width: 40,
          value: (row) => row.locationDescription,
        },
      );
    }

    columns.push(
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
        value: (row) => this.formatDate(row.finalizedAt ?? row.createdAt),
      },
      ...this.ncColumns(),
    );

    return columns;
  }

  private ncColumns(): ExcelColumn<InspectionListItemDto>[] {
    return Array.from({ length: NC_COLUMN_COUNT }, (_, index) => ({
      header: `NC ${index + 1}`,
      width: 28,
      value: (row: InspectionListItemDto) =>
        row.pendingItemsPreview?.[index] ?? '',
    }));
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
    const date = this.toValidDate(value);
    if (!date) {
      return '';
    }
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  }

  private formatDateTime(value?: Date | string | null): string {
    const date = this.toValidDate(value);
    if (!date) {
      return '';
    }
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  }

  private toValidDate(value?: Date | string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private todayInSaoPaulo(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
  }
}
