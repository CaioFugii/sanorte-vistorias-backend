import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { InspectionsService } from '../inspections/inspections.service';
import * as XLSX from 'xlsx';
import {
  Contract,
  Inspection,
  ServiceOrder,
  ServiceOrderImport,
  ServiceOrderImportLine,
  Sector,
} from '../entities';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import {
  ParsedServiceOrderImportRow,
  ServiceOrderImportParserService,
} from './import/service-order-import-parser.service';
import { ServiceOrderSpreadsheetStorage } from './service-order-spreadsheet.storage';
import {
  applyContractScopeFilter,
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';
import {
  InspectionStatus,
  ModuleType,
  ServiceOrderImportLineStatus,
  UserRole,
} from '../common/enums';
import {
  isPostWorkRequired,
  postWorkEligibleResults,
  postWorkEligibleSql,
} from './post-work-eligibility';
import {
  monthDateRange,
  previousYearMonth,
  saoPauloYearMonth,
  currentMonthToDate,
} from './service-order-periods';

export interface ImportResult {
  id: string;
  inserted: number;
  skipped: number;
  deleted: number;
  notRegistered: number;
  errors: string[];
}

type ImportRowDecision =
  | { kind: 'skip' }
  | {
      kind: 'silent';
      osNumber: string;
      sectorName: string | null;
      resultado: string | null;
      sectorId: string | null;
      serviceIdentifier: string;
    }
  | {
      kind: 'reject';
      message: string;
      osNumber: string | null;
      sectorName: string | null;
      resultado: string | null;
    }
  | {
      kind: 'enter';
      parsed: ParsedServiceOrderImportRow;
      sectorId: string;
      serviceIdentifier: string;
      importKey: string;
    };

export interface ServiceOrderStageSummary {
  remote: { total: number; done: number };
  postWork: { total: number; done: number };
}

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);
  private static readonly MIN_SEARCH_LENGTH = 3;

  constructor(
    @InjectRepository(ServiceOrder)
    private readonly serviceOrderRepository: Repository<ServiceOrder>,
    @InjectRepository(Sector)
    private readonly sectorsRepository: Repository<Sector>,
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    @InjectRepository(Inspection)
    private readonly inspectionRepository: Repository<Inspection>,
    @InjectRepository(ServiceOrderImport)
    private readonly importRepository: Repository<ServiceOrderImport>,
    @InjectRepository(ServiceOrderImportLine)
    private readonly importLineRepository: Repository<ServiceOrderImportLine>,
    private readonly serviceOrderImportParser: ServiceOrderImportParserService,
    private readonly spreadsheetStorage: ServiceOrderSpreadsheetStorage,
    private readonly dataSource: DataSource,
    private readonly inspectionsService: InspectionsService,
  ) {}

  private readInspectionCount(rawRow?: Record<string, unknown>): number {
    if (!rawRow) return 0;
    const direct = rawRow.inspectionCount ?? rawRow.inspectioncount;
    const value =
      direct ??
      Object.entries(rawRow).find(([key]) =>
        key.toLowerCase().endsWith('inspectioncount'),
      )?.[1];
    const count = Number(value ?? 0);
    return Number.isFinite(count) ? count : 0;
  }

  private toSearchTerm(value?: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < ServiceOrdersService.MIN_SEARCH_LENGTH) {
      return undefined;
    }
    return trimmed;
  }

  private buildImportKey(
    osNumber: string,
    sectorName: string,
    resultado: string | null,
  ): string {
    if (sectorName === 'REPOSICAO') {
      return `${osNumber}-${sectorName}-${(resultado ?? '').trim().toUpperCase()}`;
    }
    return `${osNumber}-${sectorName}`;
  }

  private parseFimExecucaoBoundary(
    value: string,
    boundary: 'start' | 'end',
  ): Date {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        `${boundary === 'start' ? 'from' : 'to'} must be a valid ISO8601 date`,
      );
    }

    // Accept date-only inputs by expanding to full-day boundaries (UTC).
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const iso =
        boundary === 'start'
          ? `${trimmed}T00:00:00.000Z`
          : `${trimmed}T23:59:59.999Z`;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(
          `${boundary === 'start' ? 'from' : 'to'} must be a valid ISO8601 date`,
        );
      }
      return d;
    }

    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        `${boundary === 'start' ? 'from' : 'to'} must be a valid ISO8601 date`,
      );
    }
    return d;
  }

  /**
   * Rejects when the span from `from` through `to` exceeds 2 calendar years:
   * `to` must not be after the end (UTC) of the day that is exactly 2 years after `from`.
   */
  private assertFimExecucaoRangeAtMostTwoYears(
    fromDate: Date,
    toDate: Date,
  ): void {
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from deve ser anterior ou igual a to.');
    }
    const maxTo = new Date(fromDate);
    maxTo.setUTCFullYear(maxTo.getUTCFullYear() + 2);
    maxTo.setUTCHours(23, 59, 59, 999);
    if (toDate.getTime() > maxTo.getTime()) {
      throw new BadRequestException(
        'O intervalo entre from e to não pode ser maior que 2 anos.',
      );
    }
  }

  private applyListFilters(
    query: ReturnType<Repository<ServiceOrder>['createQueryBuilder']>,
    user: any,
    filters: {
      osNumber?: string;
      contractId?: string;
      from?: string;
      to?: string;
      sectorId?: string;
      field?: boolean;
      remote?: boolean;
      postWork?: boolean;
      postWorkEligible?: boolean;
      equipe?: string;
      resultado?: string;
    },
  ): void {
    const osNumberTerm = this.toSearchTerm(filters.osNumber);
    if (osNumberTerm) {
      query.andWhere('serviceOrder.osNumber ILIKE :osNumber', {
        osNumber: `%${osNumberTerm}%`,
      });
    }

    if (filters.contractId) {
      query.andWhere('serviceOrder.contractId = :contractId', {
        contractId: filters.contractId,
      });
    }

    if (filters.from || filters.to) {
      const from = filters.from?.trim();
      const to = filters.to?.trim();
      const dateOnly = (value?: string) =>
        value == null || /^\d{4}-\d{2}-\d{2}$/.test(value);
      if (dateOnly(from) && dateOnly(to)) {
        if (from && to) {
          this.assertFimExecucaoRangeAtMostTwoYears(
            new Date(`${from}T00:00:00.000Z`),
            new Date(`${to}T00:00:00.000Z`),
          );
          query.andWhere(
            `DATE(timezone('America/Sao_Paulo', "serviceOrder"."fim_execucao")) BETWEEN :from AND :to`,
            { from, to },
          );
        } else if (from) {
          query.andWhere(
            `DATE(timezone('America/Sao_Paulo', "serviceOrder"."fim_execucao")) >= :from`,
            { from },
          );
        } else if (to) {
          query.andWhere(
            `DATE(timezone('America/Sao_Paulo', "serviceOrder"."fim_execucao")) <= :to`,
            { to },
          );
        }
      } else {
        const fromDate = from
          ? this.parseFimExecucaoBoundary(from, 'start')
          : undefined;
        const toDate = to
          ? this.parseFimExecucaoBoundary(to, 'end')
          : undefined;

        if (fromDate && toDate) {
          this.assertFimExecucaoRangeAtMostTwoYears(fromDate, toDate);
          query.andWhere('serviceOrder.fimExecucao BETWEEN :from AND :to', {
            from: fromDate,
            to: toDate,
          });
        } else if (fromDate) {
          query.andWhere('serviceOrder.fimExecucao >= :from', { from: fromDate });
        } else if (toDate) {
          query.andWhere('serviceOrder.fimExecucao <= :to', { to: toDate });
        }
      }
    }

    if (filters.sectorId) {
      query.andWhere('serviceOrder.sectorId = :sectorId', {
        sectorId: filters.sectorId,
      });
    }
    this.applyStagePresenceFilter(query, 'field', filters.field, ModuleType.CAMPO);
    this.applyStagePresenceFilter(
      query,
      'remote',
      filters.remote,
      ModuleType.REMOTO,
    );
    this.applyStagePresenceFilter(
      query,
      'postWork',
      filters.postWork,
      ModuleType.POS_OBRA,
    );
    if (filters.postWorkEligible) {
      query.andWhere(postWorkEligibleSql('serviceOrder'), {
        postWorkEligibleResults: postWorkEligibleResults(),
      });
    }
    const equipeTerm = this.toSearchTerm(filters.equipe);
    if (equipeTerm) {
      query.andWhere('serviceOrder.equipe ILIKE :equipe', {
        equipe: `%${equipeTerm}%`,
      });
    }
    const resultadoTerm = this.toSearchTerm(filters.resultado);
    if (resultadoTerm) {
      query.andWhere('serviceOrder.resultado ILIKE :resultado', {
        resultado: `%${resultadoTerm}%`,
      });
    }

    applyContractScopeFilter(
      query,
      getAllowedContractIds(user),
      'serviceOrder.contractId',
    );
  }

  private applyStagePresenceFilter(
    query: ReturnType<Repository<ServiceOrder>['createQueryBuilder']>,
    param: string,
    value: boolean | undefined,
    module: ModuleType,
  ): void {
    if (value === undefined) return;
    const exists = `EXISTS (
      SELECT 1 FROM inspections stage_inspection
      WHERE stage_inspection.service_order_id = "serviceOrder"."id"
        AND stage_inspection.module = :${param}Module
    )`;
    query.andWhere(value ? exists : `NOT ${exists}`, {
      [`${param}Module`]: module,
    });
  }

  private async attachStagePresence<T extends ServiceOrder>(
    rows: T[],
  ): Promise<
    Array<
      T & {
        postWorkRequired: boolean;
        fieldInspectionId: string | null;
        remoteInspectionId: string | null;
        postWorkInspectionId: string | null;
      }
    >
  > {
    const ids = rows.map((row) => row.id).filter(Boolean);
    const present = new Map<string, Set<string>>();
    const externalIds = new Map<string, string | null>();
    const linkKey = (serviceOrderId: string, module: string) =>
      `${serviceOrderId}:${module}`;
    if (ids.length > 0) {
      const found = await this.inspectionRepository.manager.query<
        Array<{ serviceOrderId: string; module: string; inspectionId: string | null }>
      >(
        `SELECT DISTINCT ON (service_order_id, module)
           service_order_id AS "serviceOrderId",
           module,
           COALESCE(external_id, id) AS "inspectionId"
         FROM inspections
         WHERE service_order_id = ANY($1)
           AND module = ANY($2)
         ORDER BY service_order_id, module, created_at DESC`,
        [ids, [ModuleType.CAMPO, ModuleType.REMOTO, ModuleType.POS_OBRA]],
      );
      for (const row of found) {
        const stages = present.get(row.serviceOrderId) ?? new Set<string>();
        stages.add(row.module);
        present.set(row.serviceOrderId, stages);
        externalIds.set(linkKey(row.serviceOrderId, row.module), row.inspectionId ?? null);
      }
    }

    return rows.map((row) => {
      const stages = present.get(row.id) ?? new Set<string>();
      row.field = stages.has(ModuleType.CAMPO);
      row.remote = stages.has(ModuleType.REMOTO);
      row.postWork = stages.has(ModuleType.POS_OBRA);
      return Object.assign(row, {
        postWorkRequired: isPostWorkRequired(row.resultado),
        fieldInspectionId:
          externalIds.get(linkKey(row.id, ModuleType.CAMPO)) ?? null,
        remoteInspectionId:
          externalIds.get(linkKey(row.id, ModuleType.REMOTO)) ?? null,
        postWorkInspectionId:
          externalIds.get(linkKey(row.id, ModuleType.POS_OBRA)) ?? null,
      });
    });
  }

  async summarize(
    user: any,
    filters: {
      osNumber?: string;
      contractId?: string;
      sectorId?: string;
      field?: boolean;
      remote?: boolean;
      postWork?: boolean;
      equipe?: string;
      resultado?: string;
      postWorkEligible?: boolean;
    },
  ): Promise<ServiceOrderStageSummary> {
    const current = saoPauloYearMonth(new Date());
    const remoteRange = currentMonthToDate();
    const previous = previousYearMonth(current.year, current.month);
    const postRange = monthDateRange(previous.year, previous.month);
    const remotePeriod = `"serviceOrder"."fim_execucao" IS NOT NULL AND DATE(timezone('America/Sao_Paulo', "serviceOrder"."fim_execucao")) BETWEEN :summaryRemoteFrom AND :summaryRemoteTo`;
    const postPeriod = `"serviceOrder"."fim_execucao" IS NOT NULL AND DATE(timezone('America/Sao_Paulo', "serviceOrder"."fim_execucao")) BETWEEN :summaryPostFrom AND :summaryPostTo AND ${postWorkEligibleSql('serviceOrder')}`;
    const remoteExists = `EXISTS (
      SELECT 1 FROM inspections summary_remote
      WHERE summary_remote.service_order_id = "serviceOrder"."id"
        AND summary_remote.module = :summaryRemoteModule
        AND summary_remote.status <> :summaryDraftStatus
    )`;
    const postExists = `EXISTS (
      SELECT 1 FROM inspections summary_post
      WHERE summary_post.service_order_id = "serviceOrder"."id"
        AND summary_post.module = :summaryPostModule
        AND summary_post.status <> :summaryDraftStatus
    )`;

    const query = this.serviceOrderRepository.createQueryBuilder('serviceOrder');
    this.applyListFilters(query, user, {
      osNumber: filters.osNumber,
      contractId: filters.contractId,
      sectorId: filters.sectorId,
      field: filters.field,
      remote: filters.remote,
      postWork: filters.postWork,
      equipe: filters.equipe,
      resultado: filters.resultado,
      postWorkEligible: filters.postWorkEligible,
    });
    query
      .select(`COUNT(*) FILTER (WHERE ${remotePeriod})`, 'remoteTotal')
      .addSelect(
        `COUNT(*) FILTER (WHERE ${remotePeriod} AND ${remoteExists})`,
        'remoteDone',
      )
      .addSelect(`COUNT(*) FILTER (WHERE ${postPeriod})`, 'postTotal')
      .addSelect(
        `COUNT(*) FILTER (WHERE ${postPeriod} AND ${postExists})`,
        'postDone',
      )
      .setParameter('summaryRemoteFrom', remoteRange.from)
      .setParameter('summaryRemoteTo', remoteRange.to)
      .setParameter('summaryPostFrom', postRange.from)
      .setParameter('summaryPostTo', postRange.to)
      .setParameter('summaryRemoteModule', ModuleType.REMOTO)
      .setParameter('summaryPostModule', ModuleType.POS_OBRA)
      .setParameter('summaryDraftStatus', InspectionStatus.RASCUNHO)
      .setParameter('postWorkEligibleResults', postWorkEligibleResults());

    const row = await query.getRawOne<{
      remoteTotal: string;
      remoteDone: string;
      postTotal: string;
      postDone: string;
    }>();
    const count = (value: string | undefined) => Number(value ?? 0);

    return {
      remote: {
        total: count(row?.remoteTotal),
        done: count(row?.remoteDone),
      },
      postWork: {
        total: count(row?.postTotal),
        done: count(row?.postDone),
      },
    };
  }

  async findAll(
    user: any,
    page: number = 1,
    limit: number = 10,
    osNumber?: string,
    contractId?: string,
    from?: string,
    to?: string,
    sectorId?: string,
    field?: boolean,
    remote?: boolean,
    postWork?: boolean,
    equipe?: string,
    resultado?: string,
    postWorkEligible?: boolean,
  ): Promise<
    PaginatedResponseDto<
      ServiceOrder & { postWorkRequired: boolean; inspectionCount: number }
    >
  > {
    const skip = (page - 1) * limit;

    const query = this.serviceOrderRepository
      .createQueryBuilder('serviceOrder')
      .leftJoinAndSelect('serviceOrder.sector', 'sector')
      .leftJoinAndSelect('serviceOrder.contract', 'contract');

    this.applyListFilters(query, user, {
      osNumber,
      contractId,
      from,
      to,
      sectorId,
      field,
      remote,
      postWork,
      equipe,
      resultado,
      postWorkEligible,
    });

    const total = await query.clone().getCount();
    const { entities, raw } = await query
      .addSelect(
        `(SELECT COUNT(*)::int FROM inspections inspection_count WHERE inspection_count.service_order_id = "serviceOrder"."id")`,
        'inspectionCount',
      )
      .skip(skip)
      .take(limit)
      .orderBy('serviceOrder.osNumber', 'ASC')
      .getRawAndEntities();

    const withCounts = entities.map((row, index) =>
      Object.assign(row, {
        inspectionCount: this.readInspectionCount(raw[index]),
      }),
    );
    const totalPages = Math.ceil(total / limit);

    return {
      data: await this.attachStagePresence(withCounts),
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

  async findForExport(
    user: any,
    filters: {
      osNumber?: string;
      contractId?: string;
      from?: string;
      to?: string;
      sectorId?: string;
      field?: boolean;
      remote?: boolean;
      postWork?: boolean;
      postWorkEligible?: boolean;
      equipe?: string;
      resultado?: string;
    },
    maxRows: number,
  ): Promise<Array<ServiceOrder & { postWorkRequired: boolean }>> {
    const query = this.serviceOrderRepository
      .createQueryBuilder('serviceOrder')
      .leftJoin('serviceOrder.sector', 'sector')
      .leftJoin('serviceOrder.contract', 'contract')
      .select([
        'serviceOrder.id',
        'serviceOrder.osNumber',
        'serviceOrder.address',
        'serviceOrder.field',
        'serviceOrder.remote',
        'serviceOrder.postWork',
        'serviceOrder.status',
        'serviceOrder.equipe',
        'serviceOrder.fimExecucao',
        'serviceOrder.tempoExecucaoEfetivo',
        'serviceOrder.resultado',
        'serviceOrder.updatedAt',
        'sector.id',
        'sector.name',
        'contract.id',
        'contract.name',
      ]);

    this.applyListFilters(query, user, filters);

    const rows = await query
      .orderBy('serviceOrder.osNumber', 'ASC')
      .take(maxRows + 1)
      .getMany();

    if (rows.length > maxRows) {
      throw new BadRequestException(
        `A exportação ultrapassa o limite de ${maxRows} ordens de serviço. Refine os filtros e tente novamente.`,
      );
    }

    return this.attachStagePresence(rows);
  }

  async findContractName(contractId?: string): Promise<string | null> {
    if (!contractId) {
      return null;
    }
    const contract = await this.contractsRepository.findOne({
      where: { id: contractId },
      select: ['id', 'name'],
    });
    return contract?.name ?? null;
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
      (user?.role === UserRole.GESTOR || user?.role === UserRole.SUPERVISOR) &&
      allowedContractIds !== null &&
      !allowedContractIds.includes(contractId)
    ) {
      this.logger.warn('Service order import blocked by contract scope', {
        contractId,
        userId: user?.id,
        userRole: user?.role,
      });
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

    const storedFile = await this.spreadsheetStorage.save(
      file.buffer,
      file.originalname || 'ordens-de-servico.xlsx',
    );

    const result = {
      inserted: 0,
      skipped: 0,
      deleted: 0,
      errors: [] as string[],
    };
    const lineDrafts: Array<Partial<ServiceOrderImportLine>> = [];

    const cancelledPairs = new Map<
      string,
      { osNumber: string; sectorId: string; serviceIdentifier: string }
    >();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { osNumber, sectorName, status, resultado } =
        this.serviceOrderImportParser.parseForCancellation(row);

      if (!osNumber || !sectorName || !status) continue;

      const sector = sectorsByName.get(sectorName);
      if (!sector) continue;

      if (status.toUpperCase() !== 'CANCELADA') continue;

      const key = this.buildImportKey(osNumber, sectorName, resultado);
      if (!cancelledPairs.has(key)) {
        cancelledPairs.set(key, {
          osNumber,
          sectorId: sector.id,
          serviceIdentifier:
            sectorName === 'REPOSICAO'
              ? (resultado ?? '').trim().toUpperCase()
              : '',
        });
      }
    }

    if (cancelledPairs.size > 0) {
      const pairs = [...cancelledPairs.values()];
      const toDelete = await this.serviceOrderRepository.find({
        where: pairs.map((p) => ({
          osNumber: p.osNumber,
          sectorId: p.sectorId,
          contractId,
          serviceIdentifier: p.serviceIdentifier,
        })),
        select: ['id'],
      });
      if (toDelete.length > 0) {
        await this.serviceOrderRepository.delete(toDelete.map((e) => e.id));
        result.deleted = toDelete.length;
      }
    }

    const seenKeys = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNumber = i + 2;
      const decision = this.classifyImportRow(row, sectorsByName, seenKeys);
      const rawRow = this.spreadsheetCells(row);

      if (decision.kind === 'skip') {
        result.skipped++;
        continue;
      }
      if (decision.kind === 'silent') {
        continue;
      }
      if (decision.kind === 'reject') {
        const reason = `Linha ${lineNumber}: ${decision.message}`;
        result.errors.push(reason);
        lineDrafts.push(
          this.lineDraft(lineNumber, rawRow, {
            status: ServiceOrderImportLineStatus.NOT_REGISTERED,
            osNumber: decision.osNumber,
            sectorName: decision.sectorName,
            resultado: decision.resultado,
            reason,
          }),
        );
        continue;
      }

      try {
        await this.upsertImportedServiceOrder(contractId, decision);
        seenKeys.add(decision.importKey);
        result.inserted++;
        lineDrafts.push(
          this.lineDraft(lineNumber, rawRow, {
            status: ServiceOrderImportLineStatus.ENTERED,
            osNumber: decision.parsed.osNumber,
            sectorName: decision.parsed.sectorName,
            resultado: decision.parsed.resultado,
            reason: null,
            resolvedAt: new Date(),
          }),
        );
      } catch (error: any) {
        const reason = `Linha ${lineNumber}: ${error?.message || String(error)}`;
        result.errors.push(reason);
        lineDrafts.push(
          this.lineDraft(lineNumber, rawRow, {
            status: ServiceOrderImportLineStatus.NOT_REGISTERED,
            osNumber: decision.parsed.osNumber,
            sectorName: decision.parsed.sectorName,
            resultado: decision.parsed.resultado,
            reason,
          }),
        );
      }
    }

    const notRegistered = lineDrafts.filter(
      (line) => line.status === ServiceOrderImportLineStatus.NOT_REGISTERED,
    ).length;
    const savedImport = await this.importRepository.save(
      this.importRepository.create({
        userId: user.id,
        contractId,
        originalFileName: file.originalname || 'ordens-de-servico.xlsx',
        storageKey: storedFile.key,
        storageProvider: storedFile.provider,
        insertedCount: result.inserted,
        skippedCount: result.skipped,
        deletedCount: result.deleted,
        notRegisteredCount: notRegistered,
      }),
    );
    if (lineDrafts.length > 0) {
      await this.importLineRepository.save(
        lineDrafts.map((line) =>
          this.importLineRepository.create({
            ...line,
            importId: savedImport.id,
          }),
        ),
      );
    }

    this.logger.log('Service order import completed', {
      contractId,
      importId: savedImport.id,
      userId: user?.id,
      inserted: result.inserted,
      skipped: result.skipped,
      deleted: result.deleted,
      notRegistered,
    });

    return {
      id: savedImport.id,
      inserted: result.inserted,
      skipped: result.skipped,
      deleted: result.deleted,
      notRegistered,
      errors: result.errors,
    };
  }

  async listImports(
    user: any,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Record<string, unknown>>> {
    this.assertHistoryAccess(user);
    const allowedContractIds = getAllowedContractIds(user);
    if (allowedContractIds !== null && allowedContractIds.length === 0) {
      return this.emptyImportPage(page, limit);
    }

    const where =
      allowedContractIds === null
        ? {}
        : { contractId: In(allowedContractIds) };
    const [rows, total] = await this.importRepository.findAndCount({
      where,
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

  async getImport(user: any, id: string): Promise<Record<string, unknown>> {
    const record = await this.loadVisibleImport(user, id);
    const lines = await this.importLineRepository.find({
      where: { importId: record.id },
      order: { lineNumber: 'ASC' },
    });
    return {
      ...this.toImportSummary(record),
      lines: lines.map((line) => this.toImportLine(line)),
    };
  }

  async downloadImportFile(
    user: any,
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const record = await this.loadVisibleImport(user, id);
    const buffer = await this.spreadsheetStorage.read(
      record.storageKey,
      record.storageProvider,
    );
    return {
      buffer,
      fileName: record.originalFileName,
      contentType: this.spreadsheetStorage.contentTypeForName(
        record.originalFileName,
      ),
    };
  }

  async reprocessLine(
    user: any,
    importId: string,
    lineId: string,
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const record = await this.loadVisibleImport(user, importId);
    const line = await this.importLineRepository.findOne({
      where: { id: lineId, importId: record.id },
    });
    if (!line) {
      throw new NotFoundException('Linha da importação não encontrada');
    }
    if (line.status !== ServiceOrderImportLineStatus.NOT_REGISTERED) {
      throw new BadRequestException('Esta linha já foi registrada.');
    }

    const sectors = await this.sectorsRepository.find();
    const sectorsByName = new Map(sectors.map((sector) => [sector.name, sector]));
    const entered = await this.importLineRepository.find({
      where: {
        importId: record.id,
        status: ServiceOrderImportLineStatus.ENTERED,
      },
    });
    const seenKeys = new Set(
      entered
        .filter((item) => item.osNumber && item.sectorName)
        .map((item) =>
          this.buildImportKey(item.osNumber!, item.sectorName!, item.resultado),
        ),
    );
    const decision = this.classifyImportRow(row, sectorsByName, seenKeys);
    const rawRow = this.spreadsheetCells(row);

    if (decision.kind === 'enter') {
      await this.upsertImportedServiceOrder(record.contractId, decision);
      line.status = ServiceOrderImportLineStatus.ENTERED;
      line.osNumber = decision.parsed.osNumber;
      line.sectorName = decision.parsed.sectorName;
      line.resultado = decision.parsed.resultado;
      line.reason = null;
      line.rawRow = rawRow;
      line.resolvedAt = new Date();
      const saved = await this.importLineRepository.save(line);
      return this.toImportLine(saved);
    }

    if (decision.kind === 'silent') {
      if (decision.sectorId) {
        await this.deleteCancelledOrders(record.contractId, [
          {
            osNumber: decision.osNumber,
            sectorId: decision.sectorId,
            serviceIdentifier: decision.serviceIdentifier,
          },
        ]);
      }
      line.status = ServiceOrderImportLineStatus.ENTERED;
      line.osNumber = decision.osNumber;
      line.sectorName = decision.sectorName;
      line.resultado = decision.resultado;
      line.reason = null;
      line.rawRow = rawRow;
      line.resolvedAt = new Date();
      const saved = await this.importLineRepository.save(line);
      return this.toImportLine(saved);
    }

    const message =
      decision.kind === 'skip'
        ? 'Família VISTORIA é ignorada na importação'
        : decision.message;
    line.reason = `Linha ${line.lineNumber}: ${message}`;
    line.rawRow = rawRow;
    line.osNumber =
      decision.kind === 'reject' ? decision.osNumber : line.osNumber;
    line.sectorName =
      decision.kind === 'reject' ? decision.sectorName : line.sectorName;
    line.resultado =
      decision.kind === 'reject' ? decision.resultado : line.resultado;
    line.resolvedAt = null;
    const saved = await this.importLineRepository.save(line);
    return this.toImportLine(saved);
  }

  private classifyImportRow(
    row: Record<string, unknown>,
    sectorsByName: Map<string, Sector>,
    seenKeys: Set<string>,
  ): ImportRowDecision {
    const familyRaw = row['Família'] ?? row['Familia'];
    if (this.serviceOrderImportParser.shouldIgnoreFamily(familyRaw as string)) {
      return { kind: 'skip' };
    }

    const parsed = this.serviceOrderImportParser.parseRow(row);
    const identity = {
      osNumber: parsed.osNumber || null,
      sectorName: parsed.sectorName,
      resultado: parsed.resultado,
    };
    if (!parsed.osNumber) {
      return {
        kind: 'reject',
        message: 'Número da OS vazio ou inválido',
        ...identity,
      };
    }
    if (!parsed.sectorName) {
      return {
        kind: 'reject',
        message: 'Família vazia ou inválida',
        ...identity,
      };
    }
    if (!parsed.status) {
      return {
        kind: 'reject',
        message: 'Status vazio ou inválido',
        ...identity,
      };
    }
    if (parsed.status.toUpperCase() === 'CANCELADA') {
      const sector = sectorsByName.get(parsed.sectorName);
      return {
        kind: 'silent',
        osNumber: parsed.osNumber,
        sectorName: parsed.sectorName,
        resultado: parsed.resultado,
        sectorId: sector?.id ?? null,
        serviceIdentifier: this.serviceIdentifier(
          parsed.sectorName,
          parsed.resultado,
        ),
      };
    }

    const sector = sectorsByName.get(parsed.sectorName);
    if (!sector) {
      return {
        kind: 'reject',
        message: `Setor "${parsed.sectorName}" não encontrado no banco (AGUA, ESGOTO, REPOSICAO, HIDROMETRIA, DESOBSTRUCAO)`,
        ...identity,
      };
    }
    if (!parsed.address) {
      return {
        kind: 'reject',
        message:
          'Endereço composto vazio ou inválido (Endereço + Número + Bairro)',
        ...identity,
      };
    }

    const importKey = this.buildImportKey(
      parsed.osNumber,
      parsed.sectorName,
      parsed.resultado,
    );
    if (seenKeys.has(importKey)) {
      return {
        kind: 'reject',
        message: 'OS repetida neste arquivo',
        ...identity,
      };
    }

    return {
      kind: 'enter',
      parsed,
      sectorId: sector.id,
      serviceIdentifier: this.serviceIdentifier(
        parsed.sectorName,
        parsed.resultado,
      ),
      importKey,
    };
  }

  private async upsertImportedServiceOrder(
    contractId: string,
    decision: Extract<ImportRowDecision, { kind: 'enter' }>,
  ): Promise<void> {
    const parsed = decision.parsed;
    await this.serviceOrderRepository
      .createQueryBuilder()
      .insert()
      .into(ServiceOrder)
      .values({
        osNumber: parsed.osNumber,
        sectorId: decision.sectorId,
        contractId,
        address: parsed.address,
        field: false,
        remote: false,
        postWork: false,
        familia: parsed.familia,
        resultado: parsed.resultado,
        fimExecucao: parsed.fimExecucao,
        tempoExecucaoEfetivo: parsed.tempoExecucaoEfetivo,
        tempoExecucaoEfetivoSegundos: parsed.tempoExecucaoEfetivoSegundos,
        equipe: parsed.equipe,
        status: parsed.status,
        serviceIdentifier: decision.serviceIdentifier,
      })
      .orUpdate(
        [
          'contract_id',
          'status',
          'resultado',
          'fim_execucao',
          'tempo_execucao_efetivo',
          'tempo_execucao_efetivo_segundos',
          'service_identifier',
        ],
        ['contract_id', 'os_number', 'sector_id', 'service_identifier'],
      )
      .execute();
  }

  private async deleteCancelledOrders(
    contractId: string,
    pairs: Array<{
      osNumber: string;
      sectorId: string;
      serviceIdentifier: string;
    }>,
  ): Promise<number> {
    if (pairs.length === 0) return 0;
    const toDelete = await this.serviceOrderRepository.find({
      where: pairs.map((pair) => ({
        osNumber: pair.osNumber,
        sectorId: pair.sectorId,
        contractId,
        serviceIdentifier: pair.serviceIdentifier,
      })),
      select: ['id'],
    });
    if (toDelete.length === 0) return 0;
    await this.serviceOrderRepository.delete(toDelete.map((item) => item.id));
    return toDelete.length;
  }

  private serviceIdentifier(
    sectorName: string,
    resultado: string | null,
  ): string {
    return sectorName === 'REPOSICAO'
      ? (resultado ?? '').trim().toUpperCase()
      : '';
  }

  private spreadsheetCells(
    row: Record<string, unknown>,
  ): Record<string, string> {
    const cells: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      cells[key] = value === undefined || value === null ? '' : String(value);
    }
    return cells;
  }

  private lineDraft(
    lineNumber: number,
    rawRow: Record<string, string>,
    fields: Partial<ServiceOrderImportLine>,
  ): Partial<ServiceOrderImportLine> {
    return {
      lineNumber,
      rawRow,
      resolvedAt: null,
      ...fields,
    };
  }

  private assertHistoryAccess(user: any): void {
    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.GESTOR) {
      throw new ForbiddenException(
        'Você não tem acesso ao histórico de importação.',
      );
    }
  }

  private async loadVisibleImport(
    user: any,
    id: string,
  ): Promise<ServiceOrderImport> {
    this.assertHistoryAccess(user);
    const record = await this.importRepository.findOne({
      where: { id },
      relations: { contract: true, user: true },
    });
    if (!record) {
      throw new NotFoundException('Lançamento de importação não encontrado');
    }
    const allowedContractIds = getAllowedContractIds(user);
    if (
      allowedContractIds !== null &&
      !allowedContractIds.includes(record.contractId)
    ) {
      throw new ForbiddenException('Você não tem acesso a este lançamento.');
    }
    return record;
  }

  private toImportSummary(record: ServiceOrderImport): Record<string, unknown> {
    return {
      id: record.id,
      createdAt: record.createdAt,
      originalFileName: record.originalFileName,
      insertedCount: record.insertedCount,
      skippedCount: record.skippedCount,
      deletedCount: record.deletedCount,
      notRegisteredCount: record.notRegisteredCount,
      contract: record.contract
        ? { id: record.contract.id, name: record.contract.name }
        : { id: record.contractId, name: '' },
      user: record.user
        ? { id: record.user.id, name: record.user.name }
        : { id: record.userId, name: '' },
    };
  }

  private toImportLine(line: ServiceOrderImportLine): Record<string, unknown> {
    return {
      id: line.id,
      lineNumber: line.lineNumber,
      status: line.status,
      osNumber: line.osNumber,
      sectorName: line.sectorName,
      resultado: line.resultado,
      reason: line.reason,
      rawRow: line.rawRow,
      resolvedAt: line.resolvedAt,
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

  async remove(id: string): Promise<void> {
    await this.removeMany([id]);
  }

  async removeMany(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Informe ao menos uma ordem de serviço.');
    }

    const orders = await this.serviceOrderRepository.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'osNumber'],
    });
    if (orders.length !== uniqueIds.length) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }

    const orderById = new Map(orders.map((order) => [order.id, order]));
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const id of uniqueIds) {
        const order = orderById.get(id)!;
        try {
          const inspections = await queryRunner.manager.find(Inspection, {
            where: { serviceOrderId: id },
            select: ['id'],
          });
          for (const inspection of inspections) {
            await this.inspectionsService.remove(
              inspection.id,
              UserRole.ADMIN,
              queryRunner.manager,
            );
          }
          await queryRunner.manager.delete(ServiceOrder, id);
        } catch (error) {
          const reason =
            error instanceof Error && error.message
              ? error.message
              : 'Não foi possível apagar a vistoria.';
          this.logger.warn('Service order batch stopped', {
            serviceOrderId: id,
            osNumber: order.osNumber,
            reason,
          });
          throw new BadRequestException(
            `A exclusão parou na OS ${order.osNumber}. ${reason}`,
          );
        }
      }
      await queryRunner.commitTransaction();
      this.logger.log('Service orders removed', { ids: uniqueIds });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
