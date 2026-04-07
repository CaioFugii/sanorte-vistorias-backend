import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Contract, ServiceOrder, Sector } from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { ServiceOrderImportParserService } from './import/service-order-import-parser.service';
import {
  applyContractScopeFilter,
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';
import { UserRole } from '../common/enums';

export interface ImportResult {
  inserted: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

@Injectable()
export class ServiceOrdersService {
  constructor(
    @InjectRepository(ServiceOrder)
    private readonly serviceOrderRepository: Repository<ServiceOrder>,
    @InjectRepository(Sector)
    private readonly sectorsRepository: Repository<Sector>,
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    private readonly serviceOrderImportParser: ServiceOrderImportParserService,
  ) {}

  async findAll(
    user: any,
    page: number = 1,
    limit: number = 10,
    osNumber?: string,
    sectorId?: string,
    field?: boolean,
    remote?: boolean,
    postWork?: boolean,
  ): Promise<PaginatedResponseDto<ServiceOrder>> {
    const skip = (page - 1) * limit;
    const allowedContractIds = getAllowedContractIds(user);

    const query = this.serviceOrderRepository
      .createQueryBuilder('serviceOrder')
      .leftJoinAndSelect('serviceOrder.sector', 'sector')
      .leftJoinAndSelect('serviceOrder.contract', 'contract');

    if (osNumber?.trim()) {
      query.andWhere('serviceOrder.osNumber ILIKE :osNumber', {
        osNumber: `%${osNumber.trim()}%`,
      });
    }
    if (sectorId) {
      query.andWhere('serviceOrder.sectorId = :sectorId', { sectorId });
    }
    if (field !== undefined) {
      query.andWhere('serviceOrder.field = :field', { field });
    }
    if (remote !== undefined) {
      query.andWhere('serviceOrder.remote = :remote', { remote });
    }
    if (postWork !== undefined) {
      query.andWhere('serviceOrder.postWork = :postWork', { postWork });
    }

    applyContractScopeFilter(
      query,
      allowedContractIds,
      'serviceOrder.contractId',
    );

    const [data, total] = await query
      .skip(skip)
      .take(limit)
      .orderBy('serviceOrder.osNumber', 'ASC')
      .getManyAndCount();

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

  async importFromExcel(
    user: any,
    file: Express.Multer.File,
    contractId: string,
  ): Promise<ImportResult> {
    if (!contractId) {
      throw new BadRequestException('contractId é obrigatório na importação');
    }

    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new BadRequestException('Contrato informado não encontrado');
    }

    const allowedContractIds = getAllowedContractIds(user);
    if (
      user?.role === UserRole.GESTOR &&
      allowedContractIds !== null &&
      !allowedContractIds.includes(contractId)
    ) {
      throw new ForbiddenException(
        'Você não tem acesso ao contrato selecionado para importação.',
      );
    }

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
      deleted: 0,
      errors: [],
    };

    const cancelledPairs = new Map<
      string,
      { osNumber: string; sectorId: string }
    >();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { osNumber, sectorName, status } =
        this.serviceOrderImportParser.parseForCancellation(row);

      if (!osNumber || !sectorName || !status) continue;

      const sector = sectorsByName.get(sectorName);
      if (!sector) continue;

      if (status.toUpperCase() !== 'CANCELADA') continue;

      const key = `${osNumber}-${sectorName}`;
      if (!cancelledPairs.has(key)) {
        cancelledPairs.set(key, { osNumber, sectorId: sector.id });
      }
    }

    if (cancelledPairs.size > 0) {
      const pairs = [...cancelledPairs.values()];
      const toDelete = await this.serviceOrderRepository.find({
        where: pairs.map((p) => ({
          osNumber: p.osNumber,
          sectorId: p.sectorId,
        })),
        select: ['id'],
      });
      if (toDelete.length > 0) {
        await this.serviceOrderRepository.delete(toDelete.map((e) => e.id));
        result.deleted = toDelete.length;
      }
    }

    const seenOsNumbers = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const familyRaw = row['Família'] ?? row['Familia'];

      if (this.serviceOrderImportParser.shouldIgnoreFamily(familyRaw)) {
        result.skipped++;
        continue;
      }

      const parsedRow = this.serviceOrderImportParser.parseRow(row);
      const {
        osNumber,
        sectorName,
        status,
        address,
        familia,
        resultado,
        fimExecucao,
        tempoExecucaoEfetivo,
        tempoExecucaoEfetivoSegundos,
        equipe,
      } = parsedRow;

      if (!osNumber) {
        result.errors.push(`Linha ${i + 2}: Número da OS vazio ou inválido`);
        continue;
      }
      if (!sectorName) {
        result.errors.push(`Linha ${i + 2}: Família vazia ou inválida`);
        continue;
      }
      if (!status) {
        result.errors.push(`Linha ${i + 2}: Status vazio ou inválido`);
        continue;
      }

      if (status.toUpperCase() === 'CANCELADA') continue;

      const sector = sectorsByName.get(sectorName);
      if (!sector) {
        result.errors.push(
          `Linha ${i + 2}: Setor "${sectorName}" não encontrado no banco (AGUA, ESGOTO, REPOSICAO, HIDROMETRIA, DESOBSTRUCAO)`,
        );
        continue;
      }
      if (!address) {
        result.errors.push(
          `Linha ${i + 2}: Endereço composto vazio ou inválido (Endereço + Número + Bairro)`,
        );
        continue;
      }
      if (seenOsNumbers.has(`${osNumber}-${sectorName}`)) {
        result.skipped++;
        continue;
      }
      seenOsNumbers.add(`${osNumber}-${sectorName}`);

      try {
        await this.serviceOrderRepository
          .createQueryBuilder()
          .insert()
          .into(ServiceOrder)
          .values({
            osNumber,
            sectorId: sector.id,
            contractId,
            address,
            field: false,
            remote: false,
            postWork: false,
            familia,
            resultado,
            fimExecucao,
            tempoExecucaoEfetivo,
            tempoExecucaoEfetivoSegundos,
            equipe,
            status,
          })
          .orUpdate(
            [
              'contract_id',
              'status',
              'resultado',
              'fim_execucao',
              'tempo_execucao_efetivo',
              'tempo_execucao_efetivo_segundos',
            ],
            ['os_number', 'sector_id'],
          )
          .execute();
        result.inserted++;
      } catch (error: any) {
        result.errors.push(
          `Linha ${i + 2}: ${error?.message || String(error)}`,
        );
      }
    }

    return result;
  }
}
