import { Injectable } from '@nestjs/common';

export interface ParsedServiceOrderImportRow {
  osNumber: string;
  sectorName: string | null;
  status: string;
  address: string;
  resultado: string | null;
  fimExecucao: Date | null;
  tempoExecucaoEfetivo: string | null;
  tempoExecucaoEfetivoSegundos: number | null;
  equipe: string | null;
}

@Injectable()
export class ServiceOrderImportParserService {
  private readonly ignoredFamilies = new Set<string>(['VISTORIA']);

  private readonly HIDROMETRIA_MAP: Record<string, string> = {
    'CORTE SUPRESSÃO ADM': 'HIDROMETRIA',
    'REATIV/RELIG/RESTAB': 'HIDROMETRIA',
    'SUPRESSÃO À PEDIDO': 'HIDROMETRIA',
    'SUPRESSÃO A PEDIDO': 'HIDROMETRIA',
    HIDRÔMETRO: 'HIDROMETRIA',
    HIDROMETRO: 'HIDROMETRIA',
    'HIDRÔMETRO PREVENTIVO': 'HIDROMETRIA',
    'OUTROS SERVIÇOS DE CAVALETE': 'HIDROMETRIA',
  };

  private readonly AGUA_MAP: Record<string, string> = {
    'LIGAÇÃO DE ÁGUA': 'AGUA',
    'OUTROS SERVIÇOS DE ÁGUA': 'AGUA',
    'RAMAL DE ÁGUA': 'AGUA',
    'REDE DE ÁGUA': 'AGUA',
    'VAZAMENTO DE ÁGUA': 'AGUA',
    CAVALETE: 'AGUA',
    ABASTECIMENTO: 'AGUA',
  };

  private readonly DESOBSTRUCAO_MAP: Record<string, string> = {
    'DESOBSTRUÍDA REDE DE ESGOTO': 'DESOBSTRUCAO',
    'DESOBSTRUIDO RAMAL DE ESGOTO': 'DESOBSTRUCAO',
    'LAVAGEM DE REDE DE ESGOTO PREVENTIVA': 'DESOBSTRUCAO',
    'LAVAGEM DE REDE DE ESGOTO': 'DESOBSTRUCAO',
    DESOBSTRUÇÃO: 'DESOBSTRUCAO',
  };

  private readonly ESGOTO_MAP: Record<string, string> = {
    'LIGAÇÃO DE ESGOTO': 'ESGOTO',
    'LIGAÇÃO DE ESGOTO ADICIONAL': 'ESGOTO',
    'LIGAÇÃO DE ESGOTO AVULSA S/V': 'ESGOTO',
    'LIGAÇÃO DE ESGOTO S/V': 'ESGOTO',
    'REMANEJADA REDE DE ESGOTO': 'ESGOTO',
    'SUBSTITUIDA LIGAÇÃO DE ESGOTO': 'ESGOTO',
    'TROCA DE RAMAL DE ESGOTO': 'ESGOTO',
    'OUTROS SERVIÇOS DE ESGOTO': 'ESGOTO',
    'CONSERTO DE ESGOTO': 'ESGOTO',
  };

  private readonly REPOSICAO_MAP: Record<string, string> = {
    'OUTROS SERVIÇOS DE REPOSIÇÃO': 'REPOSICAO',
    REPOSIÇÃO: 'REPOSICAO',
    'PI, PV, TL': 'REPOSICAO',
  };

  parseForCancellation(row: Record<string, unknown>): {
    osNumber: string;
    sectorName: string | null;
    status: string;
  } {
    const osNumberRaw = row['Número OS'];
    const familyRaw = row['Família'] ?? row['Familia'];
    const statusRaw = row['Status da OS'] ?? row['Status'];

    return {
      osNumber: this.normalizeOsNumber(
        osNumberRaw as string | number | undefined,
      ),
      sectorName: this.mapSectorFromFamily(
        familyRaw as string | number | undefined,
      ),
      status: this.normalizeString(statusRaw as string | number | undefined),
    };
  }

  parseRow(row: Record<string, unknown>): ParsedServiceOrderImportRow {
    const osNumberRaw = row['Número OS'];
    const familyRaw = row['Família'] ?? row['Familia'];
    const enderecoRaw = row['Endereço'] ?? row['Endereco'];
    const numeroRaw = row['Número'] ?? row['Numero'];
    const bairroRaw = row['Bairro'];
    const resultadoRaw = row['Resultado'] ?? 'N/A';
    const fimExecucaoRaw = row['Data Fim Execução'] ?? null;
    const tempoExecucaoEfetivoRaw = row['Tempo de execução efetivo'] ?? 'N/A';
    const equipeRaw = row['Equipe'] ?? 'N/A';
    const statusRaw = row['Status da OS'] ?? row['Status'];

    const endereco = this.normalizeString(
      enderecoRaw as string | number | undefined,
    );
    const numero = this.normalizeString(
      numeroRaw as string | number | undefined,
    );
    const bairro = this.normalizeString(
      bairroRaw as string | number | undefined,
    );

    const address = this.normalizeString(
      [endereco, numero, bairro].filter(Boolean).join(' - '),
    );

    const tempoExecucaoEfetivo = this.normalizeString(
      tempoExecucaoEfetivoRaw as string | number | undefined,
    );

    return {
      osNumber: this.normalizeOsNumber(
        osNumberRaw as string | number | undefined,
      ),
      sectorName: this.mapSectorFromFamily(
        familyRaw as string | number | undefined,
      ),
      status: this.normalizeString(statusRaw as string | number | undefined),
      address,
      resultado:
        this.normalizeString(resultadoRaw as string | number | undefined) ||
        null,
      fimExecucao: this.parseExcelDateTime(fimExecucaoRaw),
      tempoExecucaoEfetivo: tempoExecucaoEfetivo || null,
      tempoExecucaoEfetivoSegundos: this.parseDurationToSeconds(
        tempoExecucaoEfetivoRaw,
      ),
      equipe:
        this.normalizeString(equipeRaw as string | number | undefined) || null,
    };
  }

  shouldIgnoreFamily(value: string | number | undefined): boolean {
    return this.ignoredFamilies.has(this.normalizeString(value).toUpperCase());
  }

  private normalizeOsNumber(value: string | number | undefined): string {
    if (value === undefined || value === null) return '';
    const str = String(value).trim();
    if (str === '') return '';
    return str;
  }

  private normalizeString(value: string | number | undefined): string {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  private mapSectorFromFamily(
    value: string | number | undefined,
  ): string | null {
    const family = this.normalizeString(value).toUpperCase();

    const maps = [
      this.HIDROMETRIA_MAP,
      this.AGUA_MAP,
      this.DESOBSTRUCAO_MAP,
      this.ESGOTO_MAP,
      this.REPOSICAO_MAP,
    ];

    for (const map of maps) {
      if (family in map) {
        return map[family];
      }
    }

    return null;
  }

  private parseExcelDateTime(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const raw = String(value).trim();
    if (!raw) return null;

    const brDateTimeMatch = raw.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (brDateTimeMatch) {
      const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] =
        brDateTimeMatch;
      const year = Number(yyyy);
      const month = Number(mm);
      const day = Number(dd);
      const hour = Number(hh);
      const minute = Number(min);
      const second = Number(ss);
      const parsed = new Date(year, month - 1, day, hour, minute, second);

      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return parsed;
      }
      return null;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private parseDurationToSeconds(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const daysPattern = raw.match(
      /^([+-])?\s*(\d+)\s+(\d{1,2}):(\d{2}):(\d{2})$/,
    );
    if (daysPattern) {
      const [, sign = '+', days, hours, minutes, seconds] = daysPattern;
      const total =
        Number(days) * 24 * 3600 +
        Number(hours) * 3600 +
        Number(minutes) * 60 +
        Number(seconds);
      return sign === '-' ? -total : total;
    }

    const hhmmssPattern = raw.match(/^([+-])?\s*(\d{1,2}):(\d{2}):(\d{2})$/);
    if (hhmmssPattern) {
      const [, sign = '+', hours, minutes, seconds] = hhmmssPattern;
      const total =
        Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
      return sign === '-' ? -total : total;
    }

    return null;
  }
}
