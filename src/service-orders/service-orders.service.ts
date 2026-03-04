import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOperator } from 'typeorm';
import * as XLSX from 'xlsx';
import { ServiceOrder, Sector } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder)
    private readonly serviceOrderRepository: Repository<ServiceOrder>,
    @InjectRepository(Sector)
    private readonly sectorsRepository: Repository<Sector>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
    osNumber?: string,
    sectorId?: string,
  ): Promise<PaginatedResponseDto<ServiceOrder>> {
    const skip = (page - 1) * limit;
    const where: {
      osNumber?: string | FindOperator<string>;
      sectorId?: string;
    } = {};

    if (osNumber?.trim()) {
      where.osNumber = Like(`%${osNumber.trim()}%`) as FindOperator<string>;
    }
    if (sectorId) {
      where.sectorId = sectorId;
    }

    const [data, total] = await this.serviceOrderRepository.findAndCount({
      where,
      relations: ['sector'],
      skip,
      take: limit,
      order: { osNumber: 'ASC' },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async importFromExcel(file: Express.Multer.File): Promise<ImportResult> {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: '',
    });

    const sectors = await this.sectorsRepository.find();
    const sectorsByName = new Map(sectors.map((s) => [s.name, s]));

    const result: ImportResult = {
      inserted: 0,
      skipped: 0,
      errors: [],
    };

    const seenOsNumbers = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // === CAPTURA DAS COLUNAS ===
      const osNumberRaw = row['Número OS'];

      const familyRaw =
        row['Família'] ?? // (no arquivo está "Família")
        row['Familia']; // fallback caso venha sem acento

      const enderecoRaw = row['Endereço'] ?? row['Endereco'];

      const numeroRaw = row['Número'] ?? row['Numero'];

      const bairroRaw = row['Bairro'];

      // === NORMALIZA ===
      const osNumber = this.normalizeOsNumber(osNumberRaw);
      const sectorName = this.mapSectorFromFamily(familyRaw);

      const endereco = this.normalizeString(enderecoRaw);
      const numero = this.normalizeString(numeroRaw);
      const bairro = this.normalizeString(bairroRaw);

      // Endereço composto: Endereço + Número + Bairro
      const address = this.normalizeString(
        [endereco, numero, bairro].filter(Boolean).join(' - '),
      );

      // === VALIDAÇÕES ===
      if (!osNumber) {
        result.errors.push(`Linha ${i + 2}: Número da OS vazio ou inválido`);
        continue;
      }

      if (!sectorName) {
        result.errors.push(`Linha ${i + 2}: Família vazia ou inválida`);
        continue;
      }

      if (!address) {
        result.errors.push(
          `Linha ${i + 2}: Endereço composto vazio ou inválido (Endereço + Número + Bairro)`,
        );
        continue;
      }

      if (seenOsNumbers.has(osNumber)) {
        result.skipped++;
        continue;
      }

      seenOsNumbers.add(osNumber);

      const sector = sectorsByName.get(sectorName);
      if (!sector) {
        result.errors.push(
          `Linha ${i + 2}: Setor "${sectorName}" não encontrado no banco (AGUA, ESGOTO, REPOSICAO)`,
        );
        continue;
      }

      try {
        await this.serviceOrderRepository.save({
          osNumber,
          sectorId: sector.id,
          address,
          field: false,
          remote: false,
          postWork: false,
        });

        result.inserted++;
      } catch (error: any) {
        if (error?.code === '23505') {
          result.skipped++;
        } else {
          result.errors.push(
            `Linha ${i + 2}: ${error?.message || String(error)}`,
          );
        }
      }
    }

    return result;
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

  private mapSectorFromFamily(value: string | number | undefined): string {
    const family = this.normalizeString(value).toUpperCase();

    const sectorMap: Record<string, string> = {
      'CORTE SUPRESSÃO ADM': 'AGUA',
      'REATIV/RELIG/RESTAB': 'AGUA',
      'SUPRESSÃO À PEDIDO': 'AGUA',
      HIDRÔMETRO: 'AGUA',
      HIDROMETRO: 'AGUA',
      'HIDRÔMETRO PREVENTIVO': 'AGUA',
      'OUTROS SERVIÇOS DE CAVALETE': 'AGUA',
      'LIGAÇÃO DE ÁGUA': 'AGUA',
      'OUTROS SERVIÇOS DE ÁGUA': 'AGUA',
      'RAMAL DE ÁGUA': 'AGUA',
      'REDE DE ÁGUA': 'AGUA',
      'VAZAMENTO DE ÁGUA': 'AGUA',
      CAVALETE: 'AGUA',
      ABASTECIMENTO: 'AGUA',
      'SUPRESSÃO A PEDIDO': 'AGUA',

      'DESOBSTRUÍDA REDE DE ESGOTO': 'ESGOTO',
      'DESOBSTRUIDO RAMAL DE ESGOTO': 'ESGOTO',
      'LAVAGEM DE REDE DE ESGOTO PREVENTIVA': 'ESGOTO',
      'LAVAGEM DE REDE DE ESGOTO': 'ESGOTO',
      'LIGAÇÃO DE ESGOTO': 'ESGOTO',
      'LIGAÇÃO DE ESGOTO ADICIONAL': 'ESGOTO',
      'LIGAÇÃO DE ESGOTO AVULSA S/V': 'ESGOTO',
      'LIGAÇÃO DE ESGOTO S/V': 'ESGOTO',
      'REMANEJADA REDE DE ESGOTO': 'ESGOTO',
      'SUBSTITUIDA LIGAÇÃO DE ESGOTO': 'ESGOTO',
      'TROCA DE RAMAL DE ESGOTO': 'ESGOTO',
      'OUTROS SERVIÇOS DE ESGOTO': 'ESGOTO',
      'DESOBSTRUÇÃO': 'ESGOTO',
      'CONSERTO DE ESGOTO': 'ESGOTO',

      'OUTROS SERVIÇOS DE REPOSIÇÃO': 'REPOSICAO',
      REPOSIÇÃO: 'REPOSICAO',
      'PI, PV, TL': 'REPOSICAO',
    };

    return sectorMap[family] ?? null;
  }
}
