import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { getAllowedContractIds } from '../../common/auth/contract-scope.util';
import {
  InvestmentWorkImportLineStatus,
  InvestmentWorkOrigin,
  InvestmentWorkStatus,
  UserRole,
} from '../../common/enums';
import { SpreadsheetStorageService } from '../../common/utils/spreadsheet-storage.service';
import {
  InvestmentWork,
  InvestmentWorkDescription,
  InvestmentWorkImport,
  InvestmentWorkImportLine,
  Sector,
} from '../../entities';
import { normalizeServiceResult } from '../../service-orders/post-work-eligibility';
import {
  InvestmentWorkImportParserService,
  ParsedInvestmentWorkRow,
} from './investment-work-import-parser.service';

export const INVESTMENT_WORK_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const INVESTMENT_WORK_IMPORT_PREFIX = 'investment-works/imports';

export interface InvestmentWorkImportPreview {
  fileName: string;
  totalLines: number;
  descriptions: Array<{ key: string; label: string; count: number }>;
}

export type InvestmentWorkImportLineOutcome =
  | 'NOT_SELECTED'
  | 'NOT_REGISTERED'
  | 'IGNORED'
  | 'REGISTERED';

export interface ExistingInvestmentWorkDescriptionKey {
  contractId: string;
  osNumber: string;
  executionDate: string;
  descriptionKey: string;
}

export interface ClassifiedInvestmentWorkLine {
  lineNumber: number;
  osNumber: string | null;
  executionDate: string | null;
  description: string;
  descriptionKey: string;
  status: InvestmentWorkImportLineOutcome;
  reason: string | null;
  address: string;
  district: string;
  pdaTeam: string;
  rawRow: Record<string, string>;
}

export interface ClassifiedInvestmentWork {
  osNumber: string;
  executionDate: string;
  address: string;
  district: string;
  pdaTeam: string;
  descriptions: Array<{ key: string; label: string }>;
}

export interface ClassifiedInvestmentWorkImport {
  lines: ClassifiedInvestmentWorkLine[];
  works: ClassifiedInvestmentWork[];
}

export interface InvestmentWorkImportResult {
  id: string;
  created: number;
  ignored: number;
  notSelected: number;
  notRegistered: number;
  errors: string[];
}

@Injectable()
export class InvestmentWorkImportService {
  private readonly logger = new Logger(InvestmentWorkImportService.name);

  constructor(
    private readonly parser: InvestmentWorkImportParserService,
    @InjectRepository(InvestmentWork)
    private readonly works: Repository<InvestmentWork>,
    @InjectRepository(InvestmentWorkImport)
    private readonly imports: Repository<InvestmentWorkImport>,
    @InjectRepository(Sector)
    private readonly sectors: Repository<Sector>,
    private readonly storage: SpreadsheetStorageService,
    @InjectRepository(InvestmentWorkImportLine)
    private readonly lines: Repository<InvestmentWorkImportLine>,
  ) {}

  preview(file: {
    buffer: Buffer;
    originalname: string;
    size: number;
  }): InvestmentWorkImportPreview {
    if (file.size > INVESTMENT_WORK_IMPORT_MAX_BYTES) {
      throw new BadRequestException('Arquivo acima de 5 MB');
    }
    const rows = this.parser.parse(file.buffer);
    const descriptions = new Map<
      string,
      { key: string; label: string; count: number }
    >();
    for (const row of rows) {
      if (!row.descriptionKey) {
        continue;
      }
      const current = descriptions.get(row.descriptionKey);
      if (current) {
        current.count += 1;
      } else {
        descriptions.set(row.descriptionKey, {
          key: row.descriptionKey,
          label: row.description,
          count: 1,
        });
      }
    }
    return {
      fileName: file.originalname,
      totalLines: rows.length,
      descriptions: [...descriptions.values()],
    };
  }

  async importFile(
    user: {
      id: string;
      role?: string;
      contracts?: Array<{ id: string }>;
    },
    file: { buffer: Buffer; originalname: string; size: number },
    contractId: string,
    descriptions: string[],
  ): Promise<InvestmentWorkImportResult> {
    if (!descriptions?.length) {
      throw new BadRequestException('Selecione ao menos uma Descrição');
    }
    this.assertContractAccess(user, contractId);
    if (file.size > INVESTMENT_WORK_IMPORT_MAX_BYTES) {
      throw new BadRequestException('Arquivo acima de 5 MB');
    }
    const rows = this.parser.parse(file.buffer);
    const labelByKey = new Map<string, string>();
    for (const row of rows) {
      if (row.descriptionKey && !labelByKey.has(row.descriptionKey)) {
        labelByKey.set(row.descriptionKey, row.description);
      }
    }
    const unknown = descriptions.filter((key) => !labelByKey.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Descrição desconhecida: ${unknown.join(', ')}`,
      );
    }
    const sector = await this.sectors.findOne({ where: { name: 'REPOSICAO' } });
    if (!sector) {
      throw new BadRequestException('Setor REPOSICAO não encontrado');
    }
    const selectedLabels = descriptions
      .filter((key, index) => descriptions.indexOf(key) === index)
      .map((key) => labelByKey.get(key) ?? key);

    let stored: { key: string; provider: string } | null = null;
    try {
      const savedFile = await this.storage.save(
        file.buffer,
        file.originalname,
        INVESTMENT_WORK_IMPORT_PREFIX,
      );
      stored = savedFile;
      return await this.works.manager.transaction(async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
          [contractId],
        );
        const existing = await manager.find(InvestmentWorkDescription, {
          where: { contractId },
        });
        const classified = this.classify({
          contractId,
          selectedKeys: descriptions,
          existingKeys: existing.map((item) => ({
            contractId: item.contractId,
            osNumber: item.osNumber,
            executionDate: this.asDate(item.executionDate),
            descriptionKey: item.descriptionKey,
          })),
          rows,
        });
        return this.persist(manager, {
          userId: user.id,
          contractId,
          fileName: file.originalname,
          stored: savedFile,
          sectorId: sector.id,
          selectedLabels,
          classified,
        });
      });
    } catch (error) {
      if (stored) {
        await this.storage
          .remove(stored.key, stored.provider)
          .catch((removeError) => {
            this.logger.error(
              'Falha ao apagar planilha após erro na transação',
              removeError,
            );
          });
      }
      throw error;
    }
  }

  async listImports(
    user: { role?: string; contracts?: Array<{ id: string }> },
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponseDto<Record<string, unknown>>> {
    const allowed = getAllowedContractIds(user);
    if (allowed !== null && allowed.length === 0) {
      return this.emptyImportPage(page, limit);
    }
    const [rows, total] = await this.imports.findAndCount({
      where: allowed === null ? {} : { contractId: In(allowed) },
      relations: { contract: true, user: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const totalPages = Math.ceil(total / limit);
    return {
      data: rows.map((row) => this.toImportSummary(row)),
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

  async getImport(
    user: { role?: string; contracts?: Array<{ id: string }> },
    id: string,
  ): Promise<Record<string, unknown>> {
    const record = await this.loadVisibleImport(user, id);
    const lines = await this.lines.find({
      where: { importId: record.id },
      order: { lineNumber: 'ASC' },
    });
    return {
      ...this.toImportSummary(record),
      lines: lines.map((line) => ({
        lineNumber: line.lineNumber,
        osNumber: line.osNumber,
        description: line.description,
        reason: line.reason,
        rawRow: line.rawRow,
      })),
    };
  }

  async downloadImportFile(
    user: { role?: string; contracts?: Array<{ id: string }> },
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const record = await this.loadVisibleImport(user, id);
    return {
      buffer: await this.storage.read(
        record.storageKey,
        record.storageProvider,
      ),
      fileName: record.originalFileName,
      contentType: this.storage.contentTypeForName(record.originalFileName),
    };
  }

  classify(input: {
    contractId: string;
    selectedKeys: string[];
    existingKeys: ExistingInvestmentWorkDescriptionKey[];
    rows: ParsedInvestmentWorkRow[];
  }): ClassifiedInvestmentWorkImport {
    const selected = new Set(input.selectedKeys);
    const known = new Set(
      input.existingKeys.map((key) => this.descriptionIdentity(key)),
    );
    const seen = new Set<string>();
    const lines: ClassifiedInvestmentWorkLine[] = input.rows.map((row) =>
      this.classifyLine(row, selected),
    );
    const groups = new Map<string, ClassifiedInvestmentWorkLine[]>();
    for (const line of lines) {
      if (
        line.status !== 'REGISTERED' ||
        !line.osNumber ||
        !line.executionDate
      ) {
        continue;
      }
      const groupKey = `${line.osNumber}\0${line.executionDate}`;
      const group = groups.get(groupKey) ?? [];
      group.push(line);
      groups.set(groupKey, group);
    }
    for (const group of groups.values()) {
      const divergent = this.divergentFields(group);
      if (divergent.length > 0) {
        const fields = this.joinFields(divergent);
        for (const line of group) {
          line.status = 'NOT_REGISTERED';
          line.reason = `Linha ${line.lineNumber}: O.S ${line.osNumber} de ${line.executionDate} com ${fields} diferentes entre as linhas`;
        }
        continue;
      }
      for (const line of group) {
        const identity = this.descriptionIdentity({
          contractId: input.contractId,
          osNumber: line.osNumber ?? '',
          executionDate: line.executionDate ?? '',
          descriptionKey: line.descriptionKey,
        });
        if (known.has(identity) || seen.has(identity)) {
          line.status = 'IGNORED';
          continue;
        }
        seen.add(identity);
      }
    }
    return { lines, works: this.worksFrom(lines) };
  }

  private classifyLine(
    row: ParsedInvestmentWorkRow,
    selected: Set<string>,
  ): ClassifiedInvestmentWorkLine {
    const base = {
      lineNumber: row.lineNumber,
      osNumber: row.osNumber,
      executionDate: row.executionDate,
      description: row.description,
      descriptionKey: row.descriptionKey,
      address: row.address,
      district: row.district,
      pdaTeam: row.pdaTeam,
      rawRow: row.rawRow,
    };
    const problems: string[] = [];
    if (!row.osNumber) {
      problems.push(row.osError ?? 'O.S ausente');
    }
    if (!row.executionDate) {
      problems.push(row.dateError ?? 'data ausente');
    }
    if (!row.descriptionKey) {
      problems.push('Descrição ausente');
    }
    if (problems.length > 0) {
      return {
        ...base,
        status: 'NOT_REGISTERED',
        reason: `Linha ${row.lineNumber}: ${problems.join('; ')}`,
      };
    }
    if (!selected.has(row.descriptionKey)) {
      return { ...base, status: 'NOT_SELECTED', reason: null };
    }
    return { ...base, status: 'REGISTERED', reason: null };
  }

  private divergentFields(group: ClassifiedInvestmentWorkLine[]): string[] {
    const fields: Array<{
      label: string;
      value: (line: ClassifiedInvestmentWorkLine) => string;
    }> = [
      { label: 'Endereço', value: (line) => line.address },
      { label: 'Bairro', value: (line) => line.district },
      { label: 'Equipe PDA', value: (line) => line.pdaTeam },
    ];
    return fields
      .filter((field) => {
        const values = new Set(
          group.map((line) => normalizeServiceResult(field.value(line))),
        );
        return values.size > 1;
      })
      .map((field) => field.label);
  }

  private worksFrom(
    lines: ClassifiedInvestmentWorkLine[],
  ): ClassifiedInvestmentWork[] {
    const works = new Map<string, ClassifiedInvestmentWork>();
    for (const line of lines) {
      if (
        line.status !== 'REGISTERED' ||
        !line.osNumber ||
        !line.executionDate
      ) {
        continue;
      }
      const groupKey = `${line.osNumber}\0${line.executionDate}`;
      const work = works.get(groupKey);
      if (!work) {
        works.set(groupKey, {
          osNumber: line.osNumber,
          executionDate: line.executionDate,
          address: line.address,
          district: line.district,
          pdaTeam: line.pdaTeam,
          descriptions: [{ key: line.descriptionKey, label: line.description }],
        });
        continue;
      }
      if (!work.descriptions.some((item) => item.key === line.descriptionKey)) {
        work.descriptions.push({
          key: line.descriptionKey,
          label: line.description,
        });
      }
    }
    return [...works.values()];
  }

  private descriptionIdentity(
    key: ExistingInvestmentWorkDescriptionKey,
  ): string {
    return [
      key.contractId,
      key.osNumber,
      key.executionDate,
      key.descriptionKey,
    ].join('\0');
  }

  private joinFields(fields: string[]): string {
    if (fields.length <= 1) {
      return fields[0] ?? '';
    }
    if (fields.length === 2) {
      return `${fields[0]} e ${fields[1]}`;
    }
    return `${fields.slice(0, -1).join(', ')} e ${fields[fields.length - 1]}`;
  }

  private async loadVisibleImport(
    user: { role?: string; contracts?: Array<{ id: string }> },
    id: string,
  ): Promise<InvestmentWorkImport> {
    const record = await this.imports.findOne({
      where: { id },
      relations: { contract: true, user: true },
    });
    if (!record) {
      throw new NotFoundException('Lançamento de importação não encontrado');
    }
    const allowed = getAllowedContractIds(user);
    if (allowed !== null && !allowed.includes(record.contractId)) {
      throw new ForbiddenException('Você não tem acesso a este lançamento.');
    }
    return record;
  }

  private toImportSummary(
    record: InvestmentWorkImport,
  ): Record<string, unknown> {
    return {
      id: record.id,
      originalFileName: record.originalFileName,
      createdAt: record.createdAt,
      selectedDescriptions: record.selectedDescriptions,
      createdCount: record.createdCount,
      ignoredCount: record.ignoredCount,
      notSelectedCount: record.notSelectedCount,
      notRegisteredCount: record.notRegisteredCount,
      contract: record.contract
        ? { id: record.contract.id, name: record.contract.name }
        : { id: record.contractId, name: '' },
      user: record.user
        ? { id: record.user.id, name: record.user.name }
        : { id: record.userId, name: '' },
    };
  }

  private emptyImportPage(
    page: number,
    limit: number,
  ): PaginatedResponseDto<Record<string, unknown>> {
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  private assertContractAccess(
    user: { role?: string; contracts?: Array<{ id: string }> },
    contractId: string,
  ): void {
    if (user.role !== UserRole.GESTOR && user.role !== UserRole.SUPERVISOR) {
      return;
    }
    const allowed = getAllowedContractIds(user);
    if (allowed !== null && allowed.includes(contractId)) {
      return;
    }
    throw new ForbiddenException(
      'Você não tem acesso ao contrato selecionado para importação.',
    );
  }

  private async persist(
    manager: EntityManager,
    input: {
      userId: string;
      contractId: string;
      fileName: string;
      stored: { key: string; provider: string };
      sectorId: string;
      selectedLabels: string[];
      classified: ClassifiedInvestmentWorkImport;
    },
  ): Promise<InvestmentWorkImportResult> {
    const notRegistered = input.classified.lines.filter(
      (line) => line.status === 'NOT_REGISTERED',
    );
    const imported = await manager.save(
      InvestmentWorkImport,
      manager.create(InvestmentWorkImport, {
        userId: input.userId,
        contractId: input.contractId,
        originalFileName: input.fileName,
        storageKey: input.stored.key,
        storageProvider: input.stored.provider,
        selectedDescriptions: input.selectedLabels,
        createdCount: input.classified.works.length,
        ignoredCount: input.classified.lines.filter(
          (line) => line.status === 'IGNORED',
        ).length,
        notSelectedCount: input.classified.lines.filter(
          (line) => line.status === 'NOT_SELECTED',
        ).length,
        notRegisteredCount: notRegistered.length,
      }),
    );
    for (const work of input.classified.works) {
      const saved = await manager.save(
        InvestmentWork,
        manager.create(InvestmentWork, {
          contractId: input.contractId,
          createdByUserId: input.userId,
          origin: InvestmentWorkOrigin.IMPORT,
          workName: work.osNumber,
          startDate: work.executionDate,
          expectedEndDate: work.executionDate,
          address: work.address,
          district: work.district,
          pdaTeamName: work.pdaTeam,
          sectorId: input.sectorId,
          importId: imported.id,
          basin: null,
          service: null,
          teamId: null,
          materialNetwork: null,
          singularities: null,
          status: InvestmentWorkStatus.EM_ANDAMENTO,
          active: true,
        }),
      );
      for (const description of work.descriptions) {
        await manager.save(
          InvestmentWorkDescription,
          manager.create(InvestmentWorkDescription, {
            investmentWorkId: saved.id,
            importId: imported.id,
            contractId: input.contractId,
            osNumber: work.osNumber,
            executionDate: work.executionDate,
            description: description.label,
            descriptionKey: description.key,
          }),
        );
      }
    }
    for (const line of notRegistered) {
      await manager.save(
        InvestmentWorkImportLine,
        manager.create(InvestmentWorkImportLine, {
          importId: imported.id,
          lineNumber: line.lineNumber,
          status: InvestmentWorkImportLineStatus.NOT_REGISTERED,
          osNumber: line.osNumber,
          description: line.description || null,
          reason: line.reason ?? '',
          rawRow: line.rawRow,
        }),
      );
    }
    return {
      id: imported.id,
      created: input.classified.works.length,
      ignored: input.classified.lines.filter(
        (line) => line.status === 'IGNORED',
      ).length,
      notSelected: input.classified.lines.filter(
        (line) => line.status === 'NOT_SELECTED',
      ).length,
      notRegistered: notRegistered.length,
      errors: notRegistered.map((line) => line.reason ?? ''),
    };
  }

  private asDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }
}
