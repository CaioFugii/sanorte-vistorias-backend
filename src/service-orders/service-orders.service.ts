import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ServiceOrder } from '../entities';

interface ExcelRow {
  'Numero da OS'?: string | number;
  'Endereço'?: string | number;
  [key: string]: string | number | undefined;
}

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
  ) {}

  async findAll(): Promise<ServiceOrder[]> {
    return this.serviceOrderRepository.find({
      order: { osNumber: 'ASC' },
    });
  }

  async importFromExcel(file: Express.Multer.File): Promise<ImportResult> {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

    const result: ImportResult = {
      inserted: 0,
      skipped: 0,
      errors: [],
    };

    const seenOsNumbers = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const osNumberRaw = row['Numero da OS'] ?? row['Número da OS'];
      const addressRaw = row['Endereço'] ?? row['Endereco'];

      const osNumber = this.normalizeOsNumber(osNumberRaw);
      const address = this.normalizeString(addressRaw);

      if (!osNumber) {
        result.errors.push(`Linha ${i + 2}: Número da OS vazio ou inválido`);
        continue;
      }

      if (!address) {
        result.errors.push(`Linha ${i + 2}: Endereço vazio ou inválido`);
        continue;
      }

      if (seenOsNumbers.has(osNumber)) {
        result.skipped++;
        continue;
      }

      seenOsNumbers.add(osNumber);

      try {
        await this.serviceOrderRepository.save({
          osNumber,
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
          result.errors.push(`Linha ${i + 2}: ${error?.message || String(error)}`);
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
    const str = String(value).trim();
    return str;
  }
}
