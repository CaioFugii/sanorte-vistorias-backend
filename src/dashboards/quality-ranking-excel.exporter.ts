import { Injectable } from '@nestjs/common';
import { ExcelService } from '../excel/excel.service';
import { ExcelCellValue, ExcelFile } from '../excel/excel.types';
import { DashboardsService } from './dashboards.service';

type QualityRankingExportRow = Awaited<
  ReturnType<DashboardsService['getTeamsRankingForExport']>
>[number];

@Injectable()
export class QualityRankingExcelExporter {
  constructor(
    private readonly dashboardsService: DashboardsService,
    private readonly excelService: ExcelService,
  ) {}

  async export(filters: {
    user?: unknown;
    from: string;
    to: string;
    module?: Parameters<DashboardsService['getTeamsRankingForExport']>[0]['module'];
    contractId?: string;
  }): Promise<ExcelFile> {
    const rows = await this.dashboardsService.getTeamsRankingForExport({
      ...filters,
      sector: 'QUALITY',
    });
    const generatedAt = new Date();
    const today = this.formatDate(generatedAt, 'en-CA');

    return this.excelService.buildFromGrid({
      filename: `ranking-qualidade-${today}.xlsx`,
      sheets: [
        {
          name: this.sheetName(generatedAt),
          cols: [
            { wch: 36 },
            { wch: 16 },
            { wch: 22 },
            { wch: 14 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
          ],
          merges: [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
            { s: { r: 3, c: 3 }, e: { r: 3, c: 4 } },
            { s: { r: 3, c: 5 }, e: { r: 3, c: 6 } },
            { s: { r: 3, c: 7 }, e: { r: 3, c: 8 } },
            { s: { r: 3, c: 9 }, e: { r: 3, c: 10 } },
          ],
          rows: [
            [
              'CLASSIFICAÇÃO AVALIATIVA DO DEPARTAMENTO DE QUALIDADE',
            ],
            [this.periodLabel(filters.from, filters.to)],
            [this.updatedLabel(generatedAt)],
            [
              '',
              '',
              '',
              'AVALIAÇÃO REMOTA',
              '',
              'AVALIAÇÃO EM CAMPO',
              '',
              'AVALIAÇÃO PÓS OBRA',
              '',
              'MÉDIA FINAL',
              '',
            ],
            [
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
            ],
            ...rows.map((row) => this.toDataRow(row)),
          ],
        },
      ],
    });
  }

  private toDataRow(row: QualityRankingExportRow): ExcelCellValue[] {
    return [
      row.teamName,
      row.teamType,
      row.segment,
      this.percentOrBlank(row.remotePercent, row.remoteInspectionsCount),
      this.countOrBlank(row.remoteInspectionsCount),
      this.percentOrBlank(row.fieldPercent, row.fieldInspectionsCount),
      this.countOrBlank(row.fieldInspectionsCount),
      this.percentOrBlank(row.postWorkPercent, row.postWorkInspectionsCount),
      this.countOrBlank(row.postWorkInspectionsCount),
      row.averagePercent,
      row.inspectionsCount,
    ];
  }

  private percentOrBlank(percent: number, count: number): ExcelCellValue {
    return count > 0 ? percent : '';
  }

  private countOrBlank(count: number): ExcelCellValue {
    return count > 0 ? count : '';
  }

  private periodLabel(from: string, to: string): string {
    return `PERÍODO: ${this.formatIsoDate(from)} A ${this.formatIsoDate(to)}`;
  }

  private updatedLabel(value: Date): string {
    const date = this.formatDate(value, 'pt-BR');
    const time = value.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `ATUALIZADO EM ${date} ÀS ${time}`;
  }

  private sheetName(value: Date): string {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(value);
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `Ranking ${get('day')}.${get('month')}_${get('hour')}.${get('minute')}`;
  }

  private formatIsoDate(value: string): string {
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) {
      return value;
    }
    return `${day}/${month}/${year}`;
  }

  private formatDate(value: Date, locale: string): string {
    return value.toLocaleDateString(locale, {
      timeZone: 'America/Sao_Paulo',
    });
  }
}
