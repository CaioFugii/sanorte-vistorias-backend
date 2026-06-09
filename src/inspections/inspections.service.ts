import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import {
  Inspection,
  InspectionItem,
  Evidence,
  Signature,
  PendingAdjustment,
  ChecklistItem,
  Checklist,
  Collaborator,
  Team,
  ServiceOrder,
  InvestmentWork,
  User,
} from '../entities';
import {
  InspectionStatus,
  ChecklistAnswer,
  ModuleType,
  InspectionScope,
  PendingStatus,
  UserRole,
  InvestmentWorkStatus,
} from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { InspectionMineListItem } from './dto/inspection-mine-list-item.dto';
import { InspectionListItemDto } from './dto/inspection-list-item.dto';
import {
  InspectionDetailEvidenceDto,
  InspectionDetailItemDto,
  InspectionDetailResponseDto,
  InspectionDetailSignatureDto,
} from './dto/inspection-detail-response.dto';
import { InspectionDomainService } from './inspection-domain.service';
import {
  SyncInspectionDto,
  SyncSignatureDto,
} from './dto/sync-inspections.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  getAllowedContractIds,
} from '../common/auth/contract-scope.util';

type PendingItemsSummary = {
  pendingItemsCount: number;
  pendingItemsPreview: string[];
};

@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name);

  constructor(
    @InjectRepository(Inspection)
    private inspectionsRepository: Repository<Inspection>,
    @InjectRepository(InspectionItem)
    private inspectionItemsRepository: Repository<InspectionItem>,
    @InjectRepository(Evidence)
    private evidencesRepository: Repository<Evidence>,
    @InjectRepository(Signature)
    private signaturesRepository: Repository<Signature>,
    @InjectRepository(PendingAdjustment)
    private pendingAdjustmentsRepository: Repository<PendingAdjustment>,
    @InjectRepository(ChecklistItem)
    private checklistItemsRepository: Repository<ChecklistItem>,
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(ServiceOrder)
    private serviceOrderRepository: Repository<ServiceOrder>,
    @InjectRepository(InvestmentWork)
    private investmentWorkRepository: Repository<InvestmentWork>,
    private cloudinaryService: CloudinaryService,
    private dataSource: DataSource,
    private inspectionDomainService: InspectionDomainService,
  ) {}

  async create(
    inspectionData: {
      module: ModuleType;
      inspectionScope?: InspectionScope;
      checklistId: string;
      teamId?: string;
      serviceOrderId?: string;
      contractId?: string;
      investmentWorkId?: string;
      serviceDescription?: string;
      locationDescription?: string;
      collaboratorIds?: string[];
      externalId?: string;
      createdOffline?: boolean;
      syncedAt?: string;
    },
    userId: string,
    userScope?: any,
  ): Promise<Inspection> {
    const allowedContractIds = getAllowedContractIds(userScope);
    const inspectionScope = this.resolveInspectionScope(
      inspectionData.module,
      inspectionData.inspectionScope,
    );
    const teamId = inspectionData.teamId ?? null;
    const serviceOrderId = inspectionData.serviceOrderId ?? null;
    const providedContractId = inspectionData.contractId ?? null;
    const investmentWorkId = inspectionData.investmentWorkId ?? null;
    const serviceDescription = this.normalizeServiceDescription(
      inspectionData.serviceDescription,
    );
    const isInvestmentModule =
      inspectionData.module === ModuleType.OBRAS_INVESTIMENTO;

    if (this.isTeamRequired(inspectionData.module) && !teamId) {
      throw new BadRequestException(
        'teamId é obrigatório para módulos diferentes de SEGURANCA_TRABALHO.',
      );
    }

    if (this.isServiceOrderRequired(inspectionData.module) && !serviceOrderId) {
      throw new BadRequestException(
        'serviceOrderId é obrigatório. Informe uma OS válida cadastrada na tabela de ordens de serviço.',
      );
    }

    if (!serviceOrderId && !providedContractId) {
      throw new BadRequestException(
        'contractId é obrigatório quando serviceOrderId não for informado.',
      );
    }

    if (investmentWorkId && !isInvestmentModule) {
      throw new BadRequestException(
        'investmentWorkId só pode ser informado para o módulo OBRAS_INVESTIMENTO.',
      );
    }

    if (isInvestmentModule && !serviceOrderId && !investmentWorkId) {
      throw new BadRequestException(
        'investmentWorkId é obrigatório para OBRAS_INVESTIMENTO quando serviceOrderId não for informado.',
      );
    }

    if (
      this.isServiceDescriptionRequired(inspectionData.module) &&
      !serviceDescription
    ) {
      throw new BadRequestException(
        'serviceDescription é obrigatório para módulos diferentes de REMOTO.',
      );
    }

    let investmentWork: Pick<
      InvestmentWork,
      'id' | 'contractId' | 'active' | 'status'
    > | null = null;
    let resolvedContractId: string | null = null;
    if (investmentWorkId) {
      investmentWork = await this.investmentWorkRepository.findOne({
        where: { id: investmentWorkId },
        select: ['id', 'contractId', 'active', 'status'],
      });
      if (!investmentWork) {
        throw new BadRequestException('Obra de investimento não encontrada.');
      }
      if (!investmentWork.active) {
        throw new BadRequestException(
          'Não é possível vincular inspeção a uma obra inativa.',
        );
      }
      if (investmentWork.status === InvestmentWorkStatus.CANCELADA) {
        throw new BadRequestException(
          'Não é possível vincular inspeção a uma obra cancelada.',
        );
      }
      if (
        allowedContractIds !== null &&
        !allowedContractIds.includes(investmentWork.contractId)
      ) {
        throw new ForbiddenException(
          'Você não tem acesso ao contrato da obra de investimento informada.',
        );
      }
    }

    if (serviceOrderId) {
      const serviceOrder = await this.serviceOrderRepository.findOne({
        where: { id: serviceOrderId },
      });
      if (!serviceOrder) {
        throw new BadRequestException(
          'Ordem de serviço não encontrada. Cadastre a OS via importação de Excel antes de criar a vistoria.',
        );
      }

      if (
        allowedContractIds !== null &&
        (!serviceOrder.contractId ||
          !allowedContractIds.includes(serviceOrder.contractId))
      ) {
        throw new ForbiddenException(
          'Você não tem acesso ao contrato desta ordem de serviço.',
        );
      }

      if (
        investmentWork &&
        serviceOrder.contractId !== investmentWork.contractId
      ) {
        throw new BadRequestException(
          'A ordem de serviço e a obra de investimento devem pertencer ao mesmo contrato.',
        );
      }

      resolvedContractId = serviceOrder.contractId;
    } else {
      resolvedContractId = providedContractId;
    }

    if (!resolvedContractId) {
      throw new BadRequestException(
        'Não foi possível determinar o contractId da vistoria.',
      );
    }

    if (
      allowedContractIds !== null &&
      !allowedContractIds.includes(resolvedContractId)
    ) {
      throw new ForbiddenException(
        'Você não tem acesso ao contrato informado para esta vistoria.',
      );
    }

    await this.validateCollaboratorsForContractorTeam(
      teamId,
      inspectionData.collaboratorIds,
    );
    await this.validateInspectionScopeRules(
      inspectionData.module,
      inspectionScope,
      inspectionData.collaboratorIds || [],
    );

    const inspection = this.inspectionsRepository.create({
      ...inspectionData,
      inspectionScope,
      teamId,
      serviceOrderId,
      contractId: resolvedContractId,
      investmentWorkId,
      serviceDescription,
      createdByUserId: userId,
      status: InspectionStatus.RASCUNHO,
      createdOffline: inspectionData.createdOffline || false,
      syncedAt: inspectionData.syncedAt
        ? new Date(inspectionData.syncedAt)
        : null,
    });

    const savedInspection = await this.inspectionsRepository.save(inspection);
    this.logger.log('Inspection created', {
      inspectionId: savedInspection.id,
      module: savedInspection.module,
      status: savedInspection.status,
      contractId: savedInspection.contractId,
      serviceOrderId: savedInspection.serviceOrderId,
      investmentWorkId: savedInspection.investmentWorkId,
      createdByUserId: userId,
    });

    // Marcar a ordem de serviço como usada no módulo correspondente
    const serviceOrderUpdate: Partial<ServiceOrder> = {};
    if (inspectionData.module === ModuleType.CAMPO)
      serviceOrderUpdate.field = true;
    if (inspectionData.module === ModuleType.REMOTO)
      serviceOrderUpdate.remote = true;
    if (inspectionData.module === ModuleType.POS_OBRA)
      serviceOrderUpdate.postWork = true;
    if (serviceOrderId && Object.keys(serviceOrderUpdate).length > 0) {
      await this.serviceOrderRepository.update(
        serviceOrderId,
        serviceOrderUpdate,
      );
    }

    // Criar inspection items baseados no checklist
    const checklistRepository = this.dataSource.getRepository(Checklist);
    const checklist = await checklistRepository.findOne({
      where: { id: inspectionData.checklistId },
      relations: ['items'],
    });

    if (checklist && checklist.items) {
      const inspectionItems = checklist.items.map((item: ChecklistItem) =>
        this.inspectionItemsRepository.create({
          inspectionId: savedInspection.id,
          checklistItemId: item.id,
        }),
      );
      await this.inspectionItemsRepository.save(inspectionItems);
    }

    // Adicionar colaboradores se fornecidos
    if (
      inspectionData.collaboratorIds &&
      inspectionData.collaboratorIds.length > 0
    ) {
      const inspection = await this.inspectionsRepository.findOne({
        where: { id: savedInspection.id },
        relations: ['collaborators'],
      });
      if (inspection) {
        const collaboratorRepository =
          this.dataSource.getRepository(Collaborator);
        const collaborators = await collaboratorRepository.findBy({
          id: In(inspectionData.collaboratorIds),
        });
        inspection.collaborators = collaborators;
        await this.inspectionsRepository.save(inspection);
      }
    }

    return this.findOne(savedInspection.id);
  }

  async findAll(
    filters: {
      periodFrom?: string;
      periodTo?: string;
      module?: ModuleType;
      inspectionScope?: InspectionScope;
      teamId?: string;
      status?: InspectionStatus;
      osNumber?: string;
      investmentWorkId?: string;
    },
    page: number = 1,
    limit: number = 10,
    userScope?: any,
  ): Promise<PaginatedResponseDto<InspectionListItemDto>> {
    const allowedContractIds = getAllowedContractIds(userScope);
    if (filters.status === InspectionStatus.RASCUNHO) {
      return {
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: page > 1,
        },
      };
    }

    const skip = (page - 1) * limit;

    const query = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.team', 'team')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('inspection.investmentWork', 'investmentWork')
      .select([
        'inspection.id',
        'inspection.externalId',
        'inspection.module',
        'inspection.serviceDescription',
        'inspection.locationDescription',
        'inspection.status',
        'inspection.hasParalysisPenalty',
        'inspection.scorePercent',
        'inspection.finalizedAt',
        'inspection.createdAt',
      ])
      .addSelect(['team.name'])
      .addSelect(['serviceOrder.osNumber', 'serviceOrder.fimExecucao', 'serviceOrder.resultado'])
      .addSelect(['investmentWork.id', 'investmentWork.workName'])
      .andWhere('inspection.status != :draftStatus', {
        draftStatus: InspectionStatus.RASCUNHO,
      });

    if (filters.periodFrom) {
      query.andWhere('inspection.createdAt >= :periodFrom', {
        periodFrom: filters.periodFrom,
      });
    }
    if (filters.periodTo) {
      query.andWhere('inspection.createdAt <= :periodTo', {
        periodTo: filters.periodTo,
      });
    }
    if (filters.module) {
      query.andWhere('inspection.module = :module', { module: filters.module });
    }
    if (filters.inspectionScope) {
      query.andWhere('inspection.inspectionScope = :inspectionScope', {
        inspectionScope: filters.inspectionScope,
      });
    }
    if (filters.teamId) {
      query.andWhere('inspection.teamId = :teamId', { teamId: filters.teamId });
    }
    if (filters.status) {
      query.andWhere('inspection.status = :status', { status: filters.status });
    }
    if (filters.osNumber?.trim()) {
      query.andWhere('serviceOrder.osNumber ILIKE :osNumber', {
        osNumber: `%${filters.osNumber.trim()}%`,
      });
    }
    if (filters.investmentWorkId) {
      query.andWhere('inspection.investmentWorkId = :investmentWorkId', {
        investmentWorkId: filters.investmentWorkId,
      });
    }

    if (allowedContractIds !== null) {
      if (allowedContractIds.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('inspection.contractId IN (:...allowedContractIds)', {
          allowedContractIds,
        });
      }
    }

    query.skip(skip).take(limit).orderBy('inspection.createdAt', 'DESC');

    const [entities, total] = await query.getManyAndCount();
    const pendingSummaryByInspectionId =
      await this.getPendingItemsSummaryByInspectionIds(
        entities.map((inspection) => inspection.id),
      );
    const data = entities.map((row) =>
      this.toInspectionListItem(
        row,
        pendingSummaryByInspectionId.get(row.id) ?? {
          pendingItemsCount: 0,
          pendingItemsPreview: [],
        },
      ),
    );

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

  async findMine(
    userId: string,
    page: number = 1,
    limit: number = 10,
    osNumber?: string,
    inspectionScope?: InspectionScope,
    userScope?: any,
  ): Promise<PaginatedResponseDto<InspectionMineListItem>> {
    const allowedContractIds = getAllowedContractIds(userScope);
    const skip = (page - 1) * limit;

    const query = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoin('inspection.team', 'team')
      .leftJoin('inspection.serviceOrder', 'serviceOrder')
      .leftJoin('inspection.investmentWork', 'investmentWork')
      .select([
        'inspection.id',
        'inspection.externalId',
        'inspection.module',
        'inspection.serviceDescription',
        'inspection.locationDescription',
        'inspection.status',
        'inspection.hasParalysisPenalty',
        'inspection.scorePercent',
        'inspection.finalizedAt',
        'inspection.createdAt',
      ])
      .addSelect(['team.name'])
      .addSelect(['serviceOrder.id', 'serviceOrder.osNumber'])
      .addSelect(['investmentWork.id', 'investmentWork.workName'])
      .where('inspection.createdByUserId = :userId', { userId })
      .orderBy('inspection.createdAt', 'DESC');

    if (osNumber?.trim()) {
      query.andWhere('serviceOrder.osNumber ILIKE :osNumber', {
        osNumber: `%${osNumber.trim()}%`,
      });
    }
    if (inspectionScope) {
      query.andWhere('inspection.inspectionScope = :inspectionScope', {
        inspectionScope,
      });
    }

    if (allowedContractIds !== null) {
      if (allowedContractIds.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('inspection.contractId IN (:...allowedContractIds)', {
          allowedContractIds,
        });
      }
    }

    const [entities, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const data: InspectionMineListItem[] = entities.map((row) =>
      this.toInspectionListItem(row),
    );

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

  private toInspectionListItem(
    inspection: Inspection,
    pendingSummary?: PendingItemsSummary,
  ): InspectionListItemDto {
    return {
      externalId: inspection.externalId ?? inspection.id,
      module: inspection.module,
      serviceDescription: inspection.serviceDescription ?? null,
      locationDescription: inspection.locationDescription ?? null,
      status: inspection.status,
      hasParalysisPenalty: inspection.hasParalysisPenalty === true,
      scorePercent: this.normalizeScorePercent(inspection.scorePercent),
      finalizedAt: inspection.finalizedAt ?? null,
      createdAt: inspection.createdAt,
      team: inspection.team?.name ? { name: inspection.team.name } : null,
      serviceOrder: inspection.serviceOrder
        ? {
            osNumber: inspection.serviceOrder.osNumber,
            fimExecucao: inspection.serviceOrder.fimExecucao ?? null,
            resultado: inspection.serviceOrder.resultado ?? null,
          }
        : null,
      investmentWork: inspection.investmentWork
        ? {
            id: inspection.investmentWork.id,
            name: inspection.investmentWork.workName ?? null,
            workName: inspection.investmentWork.workName ?? null,
          }
        : null,
      pendingItemsCount: pendingSummary?.pendingItemsCount ?? 0,
      pendingItemsPreview: pendingSummary?.pendingItemsPreview ?? [],
    };
  }

  private async getPendingItemsSummaryByInspectionIds(
    inspectionIds: string[],
  ): Promise<Map<string, PendingItemsSummary>> {
    if (inspectionIds.length === 0) {
      return new Map<string, PendingItemsSummary>();
    }

    const rows: Array<{
      inspectionId: string;
      title: string | null;
      description: string | null;
    }> = await this.inspectionItemsRepository
      .createQueryBuilder('inspectionItem')
      .innerJoin('inspectionItem.checklistItem', 'checklistItem')
      .select('inspectionItem.inspectionId', 'inspectionId')
      .addSelect('checklistItem.title', 'title')
      .addSelect('checklistItem.description', 'description')
      .where('inspectionItem.inspectionId IN (:...inspectionIds)', {
        inspectionIds,
      })
      .andWhere('inspectionItem.answer = :nonConformAnswer', {
        nonConformAnswer: ChecklistAnswer.NAO_CONFORME,
      })
      .andWhere('inspectionItem.resolvedAt IS NULL')
      .orderBy('inspectionItem.createdAt', 'ASC')
      .addOrderBy('inspectionItem.id', 'ASC')
      .getRawMany();

    const summaryByInspectionId = new Map<string, PendingItemsSummary>();
    for (const inspectionId of inspectionIds) {
      summaryByInspectionId.set(inspectionId, {
        pendingItemsCount: 0,
        pendingItemsPreview: [],
      });
    }

    for (const row of rows) {
      const current = summaryByInspectionId.get(row.inspectionId) ?? {
        pendingItemsCount: 0,
        pendingItemsPreview: [],
      };

      current.pendingItemsCount += 1;
      if (current.pendingItemsPreview.length < 3) {
        current.pendingItemsPreview.push(
          this.resolvePendingItemPreviewText(row.title, row.description),
        );
      }

      summaryByInspectionId.set(row.inspectionId, current);
    }

    return summaryByInspectionId;
  }

  private resolvePendingItemPreviewText(
    title: string | null,
    description: string | null,
  ): string {
    const normalizedTitle = title?.trim();
    if (normalizedTitle) {
      return normalizedTitle;
    }

    const normalizedDescription = description?.trim();
    if (normalizedDescription) {
      return normalizedDescription;
    }

    return 'Item sem descrição';
  }

  async findOne(id: string): Promise<Inspection> {
    const inspection = await this.inspectionsRepository.findOne({
      where: [{ id }, { externalId: id }],
      relations: [
        'checklist',
        'checklist.items',
        'checklist.items.section',
        'checklist.sections',
        'team',
        'team.collaborators',
        'serviceOrder',
        'investmentWork',
        'createdBy',
        'items',
        'items.checklistItem',
        'items.checklistItem.section',
        'items.evidences',
        'evidences',
        'signatures',
        'collaborators',
        'pendingAdjustments',
      ],
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }

    return inspection;
  }

  async findOneDetail(id: string): Promise<InspectionDetailResponseDto> {
    const base = await this.inspectionsRepository.findOne({
      where: [{ id }, { externalId: id }],
      select: {
        id: true,
        externalId: true,
        checklistId: true,
        createdByUserId: true,
        teamId: true,
        serviceOrderId: true,
        investmentWorkId: true,
        status: true,
        module: true,
        hasParalysisPenalty: true,
        serviceDescription: true,
        locationDescription: true,
        createdAt: true,
        finalizedAt: true,
        updatedAt: true,
        scorePercent: true,
      },
    });

    if (!base) {
      throw new NotFoundException('Vistoria não encontrada');
    }

    const inspectionId = base.id;

    const [
      itemRows,
      evidenceRows,
      signatureRows,
      team,
      checklist,
      serviceOrder,
      investmentWork,
      createdBy,
      checklistItemRows,
    ] = await Promise.all([
      this.inspectionItemsRepository.find({
        where: { inspectionId },
        select: {
          id: true,
          checklistItemId: true,
          answer: true,
          notes: true,
          updatedAt: true,
          resolvedAt: true,
          resolvedByUserId: true,
          resolutionNotes: true,
          resolutionEvidencePath: true,
        },
        order: { createdAt: 'ASC' },
      }),
      this.evidencesRepository.find({
        where: { inspectionId },
        select: {
          id: true,
          inspectionItemId: true,
          fileName: true,
          mimeType: true,
          filePath: true,
          url: true,
          cloudinaryPublicId: true,
          bytes: true,
          size: true,
          format: true,
          width: true,
          height: true,
          createdAt: true,
        },
        order: { createdAt: 'ASC' },
      }),
      this.signaturesRepository.find({
        where: { inspectionId },
        select: {
          id: true,
          signerName: true,
          signedAt: true,
          url: true,
          imagePath: true,
          cloudinaryPublicId: true,
        },
        order: { signedAt: 'ASC' },
      }),
      base.teamId
        ? this.teamsRepository.findOne({
            where: { id: base.teamId },
            select: { name: true },
          })
        : Promise.resolve(null),
      this.checklistsRepository.findOne({
        where: { id: base.checklistId },
        select: { name: true },
      }),
      base.serviceOrderId
        ? this.serviceOrderRepository.findOne({
            where: { id: base.serviceOrderId },
            select: { osNumber: true },
          })
        : Promise.resolve(null),
      base.investmentWorkId
        ? this.investmentWorkRepository.findOne({
            where: { id: base.investmentWorkId },
            select: { id: true, workName: true },
          })
        : Promise.resolve(null),
      base.createdByUserId
        ? this.dataSource.getRepository(User).findOne({
            where: { id: base.createdByUserId },
            select: { name: true },
          })
        : Promise.resolve(null),
      this.checklistItemsRepository.find({
        where: { checklistId: base.checklistId },
        select: { id: true, title: true, description: true },
      }),
    ]);

    const checklistMetaById = new Map(
      checklistItemRows.map(
        (row) =>
          [
            row.id,
            {
              title: row.title ?? null,
              description: row.description ?? null,
            },
          ] as const,
      ),
    );
    const resolvedByUserIds = [
      ...new Set(itemRows.map((row) => row.resolvedByUserId).filter(Boolean)),
    ] as string[];
    const resolvedByRows =
      resolvedByUserIds.length > 0
        ? await this.dataSource.getRepository(User).find({
            where: { id: In(resolvedByUserIds) },
            select: { id: true, name: true },
          })
        : [];
    const resolvedByNameById = new Map(
      resolvedByRows.map((row) => [row.id, row.name ?? null] as const),
    );

    const items: InspectionDetailItemDto[] = itemRows.map((row) => ({
      id: row.id,
      checklistItemId: row.checklistItemId,
      checklistItem: {
        title: checklistMetaById.get(row.checklistItemId)?.title ?? null,
        description:
          checklistMetaById.get(row.checklistItemId)?.description ?? null,
      },
      answer: row.answer ?? null,
      notes: row.notes ?? null,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt ?? null,
      resolvedBy:
        row.resolvedByUserId && resolvedByNameById.get(row.resolvedByUserId)
          ? { name: resolvedByNameById.get(row.resolvedByUserId)! }
          : null,
      resolutionNotes: row.resolutionNotes ?? null,
      resolutionEvidencePath: row.resolutionEvidencePath ?? null,
    }));

    const evidences: InspectionDetailEvidenceDto[] = evidenceRows.map((ev) =>
      this.mapEvidenceDetail(ev),
    );

    const signatures: InspectionDetailSignatureDto[] = signatureRows.map(
      (sig) => this.mapSignatureDetail(sig),
    );

    return {
      id: base.id,
      externalId: base.externalId ?? null,
      serverId: base.id,
      checklistId: base.checklistId,
      status: base.status,
      module: base.module,
      hasParalysisPenalty: base.hasParalysisPenalty === true,
      serviceOrderId: base.serviceOrderId ?? null,
      serviceDescription: base.serviceDescription ?? null,
      locationDescription: base.locationDescription ?? null,
      createdAt: base.createdAt,
      finalizedAt: base.finalizedAt ?? null,
      updatedAt: base.updatedAt,
      scorePercent: this.normalizeScorePercent(base.scorePercent),
      team: team?.name != null ? { name: team.name } : null,
      checklist: checklist?.name != null ? { name: checklist.name } : null,
      serviceOrder:
        serviceOrder?.osNumber != null
          ? { osNumber: serviceOrder.osNumber }
          : null,
      investmentWork: investmentWork
        ? {
            id: investmentWork.id,
            name: investmentWork.workName,
          }
        : null,
      createdBy: createdBy?.name != null ? { name: createdBy.name } : null,
      items,
      evidences,
      signatures,
    };
  }

  private normalizeScorePercent(raw: unknown): number | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private splitPublicUrlAndDataUrl(stored: string | null | undefined): {
    url: string | null;
    dataUrl: string | null;
  } {
    const s = stored?.trim();
    if (!s) return { url: null, dataUrl: null };
    if (s.startsWith('data:')) return { url: null, dataUrl: s };
    return { url: s, dataUrl: null };
  }

  private mapEvidenceDetail(ev: Evidence): InspectionDetailEvidenceDto {
    const primary =
      (ev.url && String(ev.url).trim()) ||
      (ev.filePath && String(ev.filePath).trim()) ||
      null;
    const { url, dataUrl } = this.splitPublicUrlAndDataUrl(primary);

    const bytesVal = ev.bytes ?? ev.size;
    return {
      id: ev.id,
      inspectionItemId: ev.inspectionItemId ?? null,
      fileName: ev.fileName,
      mimeType: ev.mimeType,
      url,
      ...(dataUrl ? { dataUrl } : {}),
      ...(ev.cloudinaryPublicId
        ? { cloudinaryPublicId: ev.cloudinaryPublicId }
        : {}),
      ...(bytesVal != null ? { bytes: bytesVal } : {}),
      size: ev.size,
      ...(ev.format != null ? { format: ev.format } : {}),
      ...(ev.width != null ? { width: ev.width } : {}),
      ...(ev.height != null ? { height: ev.height } : {}),
      createdAt: ev.createdAt,
    };
  }

  private mapSignatureDetail(sig: Signature): InspectionDetailSignatureDto {
    const primary =
      (sig.url && String(sig.url).trim()) ||
      (sig.imagePath && String(sig.imagePath).trim()) ||
      null;
    const { url, dataUrl } = this.splitPublicUrlAndDataUrl(primary);

    return {
      id: sig.id,
      signerName: sig.signerName,
      signedAt: sig.signedAt,
      ...(url ? { url } : {}),
      ...(dataUrl ? { dataUrl } : {}),
      ...(sig.cloudinaryPublicId
        ? { cloudinaryPublicId: sig.cloudinaryPublicId }
        : {}),
    };
  }

  /** Para `PUT .../items`: só o necessário para regras + nota — não usar `findOne()` com grafo inteiro. */
  private async findInspectionCoreForUpdateItems(
    id: string,
  ): Promise<
    Pick<Inspection, 'id' | 'status' | 'module' | 'hasParalysisPenalty'>
  > {
    const inspection = await this.inspectionsRepository.findOne({
      where: [{ id }, { externalId: id }],
      select: ['id', 'status', 'module', 'hasParalysisPenalty'],
    });
    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }
    return inspection;
  }

  /**
   * Carrega só id/status/dono — necessário para uploads de evidência.
   * Não usar `findOne` aqui: ele puxa checklist inteiro, todos os items, todas as evidências etc.;
   * a cada foto o grafo cresce e o RSS do dyno sobe até estourar quota (Heroku R14).
   */
  private async findInspectionCoreByIdOrExternalId(
    id: string,
  ): Promise<Pick<Inspection, 'id' | 'status' | 'createdByUserId'>> {
    const inspection = await this.inspectionsRepository.findOne({
      where: [{ id }, { externalId: id }],
      select: ['id', 'status', 'createdByUserId'],
    });
    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }
    return inspection;
  }

  /**
   * Core mínimo para operações de gestão (update/remove/paralyze/unparalyze),
   * evitando carregar o grafo completo de relações da vistoria.
   */
  private async findInspectionCoreForManagement(
    id: string,
  ): Promise<
    Pick<
      Inspection,
      | 'id'
      | 'status'
      | 'module'
      | 'hasParalysisPenalty'
      | 'serviceOrderId'
      | 'teamId'
      | 'serviceDescription'
      | 'inspectionScope'
    >
  > {
    const inspection = await this.inspectionsRepository.findOne({
      where: [{ id }, { externalId: id }],
      select: [
        'id',
        'status',
        'module',
        'hasParalysisPenalty',
        'serviceOrderId',
        'teamId',
        'serviceDescription',
        'inspectionScope',
      ],
    });
    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }
    return inspection;
  }

  private async findInspectionCollaboratorIds(
    inspectionId: string,
  ): Promise<string[]> {
    const inspection = await this.inspectionsRepository.findOne({
      where: { id: inspectionId },
      relations: ['collaborators'],
    });

    return (inspection?.collaborators ?? []).map((collaborator) => collaborator.id);
  }

  private async deleteInspectionCloudinaryAssets(
    inspectionId: string,
  ): Promise<void> {
    const [evidenceRows, signatureRows] = await Promise.all([
      this.evidencesRepository.find({
        where: { inspectionId },
        select: ['cloudinaryPublicId'],
      }),
      this.signaturesRepository.find({
        where: { inspectionId },
        select: ['cloudinaryPublicId'],
      }),
    ]);

    const publicIds = [
      ...evidenceRows.map((row) => row.cloudinaryPublicId),
      ...signatureRows.map((row) => row.cloudinaryPublicId),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    const uniquePublicIds = [...new Set(publicIds)];
    for (const publicId of uniquePublicIds) {
      await this.cloudinaryService.deleteAsset(publicId);
    }
  }

  async remove(id: string): Promise<void> {
    const inspection = await this.findInspectionCoreForManagement(id);

    if (inspection.status !== InspectionStatus.RASCUNHO) {
      this.logger.warn('Inspection deletion blocked due status', {
        inspectionId: inspection.id,
        status: inspection.status,
      });
      throw new BadRequestException(
        'Só é possível excluir vistoria com status RASCUNHO',
      );
    }

    const serviceOrderUpdate: Partial<ServiceOrder> = {};
    if (inspection.module === ModuleType.CAMPO)
      serviceOrderUpdate.field = false;
    if (inspection.module === ModuleType.REMOTO)
      serviceOrderUpdate.remote = false;
    if (inspection.module === ModuleType.POS_OBRA)
      serviceOrderUpdate.postWork = false;
    if (
      inspection.serviceOrderId &&
      Object.keys(serviceOrderUpdate).length > 0
    ) {
      await this.serviceOrderRepository.update(
        inspection.serviceOrderId,
        serviceOrderUpdate,
      );
    }

    await this.deleteInspectionCloudinaryAssets(inspection.id);
    await this.inspectionsRepository.delete(inspection.id);
    this.logger.log('Inspection removed', {
      inspectionId: inspection.id,
      module: inspection.module,
    });
  }

  async update(
    id: string,
    inspectionData: Partial<Inspection>,
    userId: string,
    userRole: string,
  ): Promise<Inspection> {
    const inspection = await this.findInspectionCoreForManagement(id);
    const hasServiceOrderChange = Object.prototype.hasOwnProperty.call(
      inspectionData,
      'serviceOrderId',
    );
    const hasServiceDescriptionChange = Object.prototype.hasOwnProperty.call(
      inspectionData,
      'serviceDescription',
    );
    const hasTeamChange = Object.prototype.hasOwnProperty.call(
      inspectionData,
      'teamId',
    );
    const nextModule = inspectionData.module ?? inspection.module;
    const nextServiceOrderId = hasServiceOrderChange
      ? inspectionData.serviceOrderId
      : inspection.serviceOrderId;
    const nextServiceDescription = hasServiceDescriptionChange
      ? this.normalizeServiceDescription(
          inspectionData.serviceDescription as string | null | undefined,
        )
      : inspection.serviceDescription;
    const nextTeamId = inspectionData.teamId ?? inspection.teamId;
    const nextInspectionScope = this.resolveInspectionScope(
      nextModule,
      inspectionData.inspectionScope ?? inspection.inspectionScope,
    );
    const nextCollaboratorIds = Array.isArray(inspectionData.collaborators)
      ? inspectionData.collaborators
          .map((collaborator) => collaborator?.id)
          .filter(Boolean)
      : await this.findInspectionCollaboratorIds(inspection.id);

    // FISCAL só pode editar se status = RASCUNHO
    if (
      userRole === 'FISCAL' &&
      inspection.status !== InspectionStatus.RASCUNHO
    ) {
      this.logger.warn('Inspection update blocked for fiscal by status', {
        inspectionId: inspection.id,
        status: inspection.status,
        userId,
        userRole,
      });
      throw new ForbiddenException(
        'Fiscal não pode editar vistoria após finalização',
      );
    }

    if (this.isServiceOrderRequired(nextModule) && !nextServiceOrderId) {
      throw new BadRequestException(
        'serviceOrderId é obrigatório. Informe uma OS válida cadastrada na tabela de ordens de serviço.',
      );
    }

    if (this.isTeamRequired(nextModule) && !nextTeamId) {
      throw new BadRequestException(
        'teamId é obrigatório para módulos diferentes de SEGURANCA_TRABALHO.',
      );
    }
    if (hasTeamChange && nextTeamId) {
      await this.assertTeamExists(nextTeamId);
    }

    if (
      this.isServiceDescriptionRequired(nextModule) &&
      !nextServiceDescription
    ) {
      throw new BadRequestException(
        'serviceDescription é obrigatório para módulos diferentes de REMOTO.',
      );
    }

    if (nextServiceOrderId) {
      const serviceOrder = await this.serviceOrderRepository.findOne({
        where: { id: nextServiceOrderId },
      });
      if (!serviceOrder) {
        throw new BadRequestException(
          'Ordem de serviço não encontrada. Cadastre a OS via importação de Excel antes de criar a vistoria.',
        );
      }
    }

    await this.validateCollaboratorsForContractorTeam(
      nextTeamId,
      nextCollaboratorIds,
    );
    await this.validateInspectionScopeRules(
      nextModule,
      nextInspectionScope,
      nextCollaboratorIds,
    );

    inspectionData.inspectionScope = nextInspectionScope;
    if (hasServiceDescriptionChange) {
      inspectionData.serviceDescription = nextServiceDescription;
    }

    // GESTOR, SUPERVISOR e ADMIN podem editar sempre
    await this.inspectionsRepository.update(inspection.id, inspectionData);
    this.logger.log('Inspection updated', {
      inspectionId: inspection.id,
      updatedByUserId: userId,
      updatedByRole: userRole,
      updatedFields: Object.keys(inspectionData),
    });
    return this.findOne(inspection.id);
  }

  async updateItems(
    id: string,
    items: Array<{
      inspectionItemId: string;
      answer: ChecklistAnswer;
      notes?: string;
    }>,
    userId: string,
    userRole: UserRole,
  ): Promise<InspectionItem[]> {
    const inspection = await this.findInspectionCoreForUpdateItems(id);

    if (
      userRole === UserRole.FISCAL &&
      inspection.status !== InspectionStatus.RASCUNHO
    ) {
      throw new ForbiddenException(
        'Fiscal não pode editar vistoria após finalização',
      );
    }

    const updatedItems = [];
    for (const item of items) {
      await this.inspectionItemsRepository.update(item.inspectionItemId, {
        answer: item.answer,
        notes: item.notes,
      });
      const updated = await this.inspectionItemsRepository.findOne({
        where: {
          id: item.inspectionItemId,
          inspectionId: inspection.id,
        },
      });
      if (updated) updatedItems.push(updated);
    }

    const refreshedItems = await this.inspectionItemsRepository.find({
      where: { inspectionId: inspection.id },
      select: ['id', 'answer'],
    });
    const baseScorePercent = this.inspectionDomainService.calculateScorePercent(
      refreshedItems as InspectionItem[],
    );
    const scorePercent = this.inspectionDomainService.applyParalysisPenalty(
      baseScorePercent,
      inspection.hasParalysisPenalty === true,
    );

    const inspectionUpdates: Partial<Inspection> = { scorePercent };

    if (
      (userRole === UserRole.ADMIN ||
        userRole === UserRole.GESTOR ||
        userRole === UserRole.SUPERVISOR) &&
      (inspection.status === InspectionStatus.FINALIZADA ||
        inspection.status === InspectionStatus.PENDENTE_AJUSTE)
    ) {
      const nextStatus = this.inspectionDomainService.resolveFinalStatus(
        refreshedItems,
        inspection.module,
      );
      inspectionUpdates.status = nextStatus;
      await this.syncPendingAdjustmentByStatus(
        inspection.id,
        inspection.module,
        nextStatus,
        userId,
      );
    }

    await this.inspectionsRepository.update(inspection.id, inspectionUpdates);

    return updatedItems;
  }

  async paralyze(
    id: string,
    reason: string,
    userId: string,
  ): Promise<Inspection> {
    const inspection = await this.findInspectionCoreForManagement(id);

    if (inspection.hasParalysisPenalty) {
      return this.findOne(inspection.id);
    }

    const scorePercent = await this.calculateFinalScorePercent(
      inspection.id,
      true,
    );

    await this.inspectionsRepository.update(inspection.id, {
      paralyzedReason: reason.trim(),
      paralyzedAt: new Date(),
      paralyzedByUserId: userId,
      hasParalysisPenalty: true,
      scorePercent,
    });

    return this.findOne(inspection.id);
  }

  async unparalyze(id: string): Promise<Inspection> {
    const inspection = await this.findInspectionCoreForManagement(id);

    if (!inspection.hasParalysisPenalty) {
      return this.findOne(inspection.id);
    }

    const scorePercent = await this.calculateFinalScorePercent(
      inspection.id,
      false,
    );

    await this.inspectionsRepository.update(inspection.id, {
      hasParalysisPenalty: false,
      paralyzedReason: null,
      paralyzedAt: null,
      paralyzedByUserId: null,
      scorePercent,
    });

    return this.findOne(inspection.id);
  }

  async addEvidence(
    id: string,
    file: Express.Multer.File,
    inspectionItemId?: string,
    userId?: string,
    userRole?: UserRole,
  ): Promise<Evidence> {
    const inspection = await this.findInspectionCoreByIdOrExternalId(id);

    if (
      userRole === UserRole.FISCAL &&
      inspection.status !== InspectionStatus.RASCUNHO
    ) {
      throw new ForbiddenException(
        'Fiscal não pode editar vistoria após finalização',
      );
    }

    if (!file?.path) {
      throw new BadRequestException('Arquivo inválido ou ausente');
    }

    try {
      const uploaded = await this.cloudinaryService.uploadImageFromPath(
        file.path,
        {
          folder: 'quality/evidences',
        },
      );

      const evidence = this.evidencesRepository.create({
        inspectionId: inspection.id,
        inspectionItemId,
        filePath: uploaded.secure_url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: uploaded.bytes,
        cloudinaryPublicId: uploaded.public_id,
        url: uploaded.secure_url,
        bytes: uploaded.bytes,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
        uploadedByUserId: userId || inspection.createdByUserId,
      });

      return this.evidencesRepository.save(evidence);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  async removeEvidence(
    inspectionId: string,
    evidenceId: string,
    userRole?: UserRole,
  ): Promise<void> {
    const inspection =
      await this.findInspectionCoreByIdOrExternalId(inspectionId);

    if (
      userRole === UserRole.FISCAL &&
      inspection.status !== InspectionStatus.RASCUNHO
    ) {
      throw new ForbiddenException(
        'Fiscal não pode editar vistoria após finalização',
      );
    }

    const evidence = await this.evidencesRepository.findOne({
      where: { id: evidenceId, inspectionId: inspection.id },
    });

    if (!evidence) {
      throw new NotFoundException('Evidência não encontrada nesta vistoria');
    }

    if (evidence.cloudinaryPublicId?.trim()) {
      await this.cloudinaryService.deleteAsset(evidence.cloudinaryPublicId);
    }

    await this.evidencesRepository.delete(evidence.id);
  }

  async addSignature(
    id: string,
    signerName: string,
    imageBase64: string,
  ): Promise<Signature> {
    const inspection = await this.findInspectionCoreByIdOrExternalId(id);

    if (inspection.status !== InspectionStatus.RASCUNHO) {
      throw new BadRequestException(
        'Não é possível adicionar assinatura em vistoria finalizada',
      );
    }

    const imageBuffer = this.base64ToBuffer(imageBase64);
    const uploaded = await this.cloudinaryService.uploadImage(imageBuffer, {
      folder: 'quality/signatures',
    });

    const signature = this.signaturesRepository.create({
      inspectionId: inspection.id,
      signerName,
      signerRoleLabel: 'Lider/Encarregado',
      imagePath: uploaded.secure_url,
      cloudinaryPublicId: uploaded.public_id,
      url: uploaded.secure_url,
      signedAt: new Date(),
    });

    return this.signaturesRepository.save(signature);
  }

  async calculateScorePercent(inspectionId: string): Promise<number> {
    const items = await this.inspectionItemsRepository.find({
      where: { inspectionId },
      select: ['answer'],
    });
    return this.inspectionDomainService.calculateScorePercent(
      items as InspectionItem[],
    );
  }

  /**
   * Itens não conformes com flag de foto obrigatória devem ter ao menos uma evidência no item.
   * Evita carregar todas as evidências em memória (relação `evidences` por item).
   */
  private async assertNonConformItemsHaveRequiredEvidence(
    inspectionId: string,
  ): Promise<void> {
    const nonConformRows = await this.inspectionItemsRepository.find({
      where: {
        inspectionId,
        answer: ChecklistAnswer.NAO_CONFORME,
      },
      select: ['id', 'checklistItemId'],
    });

    if (nonConformRows.length === 0) {
      return;
    }

    const checklistIds = [
      ...new Set(nonConformRows.map((r) => r.checklistItemId)),
    ];
    const checklistMetas = await this.checklistItemsRepository.find({
      where: { id: In(checklistIds) },
      select: ['id', 'title', 'requiresPhotoOnNonConformity'],
    });
    const metaById = new Map(checklistMetas.map((c) => [c.id, c] as const));

    for (const row of nonConformRows) {
      const meta = metaById.get(row.checklistItemId);
      if (!meta?.requiresPhotoOnNonConformity) {
        continue;
      }
      const evidenceCount = await this.evidencesRepository.count({
        where: { inspectionItemId: row.id },
      });
      if (evidenceCount === 0) {
        throw new BadRequestException(
          `Item "${meta.title}" requer foto de evidência quando não conforme`,
        );
      }
    }
  }

  async finalize(id: string): Promise<InspectionDetailResponseDto> {
    const inspection = await this.findInspectionCoreForUpdateItems(id);

    if (inspection.status !== InspectionStatus.RASCUNHO) {
      this.logger.warn('Inspection finalization blocked due status', {
        inspectionId: inspection.id,
        status: inspection.status,
      });
      throw new BadRequestException('Vistoria já foi finalizada');
    }

    const inspectionId = inspection.id;

    await this.assertNonConformItemsHaveRequiredEvidence(inspectionId);

    const scorePercent = await this.calculateFinalScorePercent(
      inspectionId,
      inspection.hasParalysisPenalty === true,
    );

    const itemsForStatus = await this.inspectionItemsRepository.find({
      where: { inspectionId },
      select: ['answer'],
    });
    const status = this.inspectionDomainService.resolveFinalStatus(
      itemsForStatus as InspectionItem[],
      inspection.module,
    );

    if (status === InspectionStatus.PENDENTE_AJUSTE) {
      let pending = await this.pendingAdjustmentsRepository.findOne({
        where: { inspectionId },
      });

      if (!pending) {
        pending = this.pendingAdjustmentsRepository.create({
          inspectionId,
          status: PendingStatus.PENDENTE,
        });
      } else {
        pending.status = PendingStatus.PENDENTE;
      }
      await this.pendingAdjustmentsRepository.save(pending);
    }

    await this.inspectionsRepository.update(inspectionId, {
      status,
      scorePercent,
      finalizedAt: new Date(),
    });
    this.logger.log('Inspection finalized', {
      inspectionId,
      status,
      scorePercent,
    });

    return this.findOneDetail(inspectionId);
  }

  async syncInspections(
    inspections: SyncInspectionDto[],
    userOrId: any,
    userRoleArg?: UserRole,
  ): Promise<{
    results: Array<{
      externalId: string;
      serverId?: string;
      status: 'CREATED' | 'UPDATED' | 'ERROR';
      message?: string;
    }>;
  }> {
    const user =
      typeof userOrId === 'string'
        ? { id: userOrId, role: userRoleArg }
        : userOrId;

    if (!Array.isArray(inspections)) {
      throw new BadRequestException('Payload de sincronização inválido');
    }

    const results: Array<{
      externalId: string;
      serverId?: string;
      status: 'CREATED' | 'UPDATED' | 'ERROR';
      message?: string;
    }> = [];

    for (const payload of inspections) {
      const externalId = payload?.externalId || '';
      try {
        const result = await this.syncSingleInspection(payload, user);
        results.push(result);
      } catch (error: any) {
        results.push({
          externalId,
          status: 'ERROR',
          message: error?.message || 'Erro ao sincronizar vistoria',
        });
      }
    }

    const createdCount = results.filter((r) => r.status === 'CREATED').length;
    const updatedCount = results.filter((r) => r.status === 'UPDATED').length;
    const errorCount = results.filter((r) => r.status === 'ERROR').length;
    this.logger.log('Inspection sync batch completed', {
      total: inspections.length,
      createdCount,
      updatedCount,
      errorCount,
      userId: user?.id,
      userRole: user?.role,
    });

    return { results };
  }

  private async syncSingleInspection(
    payload: SyncInspectionDto,
    user: any,
  ): Promise<{
    externalId: string;
    serverId: string;
    status: 'CREATED' | 'UPDATED';
  }> {
    const userId = user.id;
    const userRole: UserRole = user.role;

    if (!payload?.externalId) {
      throw new BadRequestException(
        'externalId é obrigatório para sincronização',
      );
    }

    let inspection = await this.inspectionsRepository.findOne({
      where: { externalId: payload.externalId },
      relations: ['collaborators'],
    });

    let status: 'CREATED' | 'UPDATED' = 'UPDATED';

    if (!inspection) {
      if (
        this.isServiceOrderRequired(payload.module) &&
        !payload.serviceOrderId
      ) {
        throw new BadRequestException(
          'serviceOrderId é obrigatório para criar nova vistoria. Cadastre a OS via importação de Excel antes de sincronizar.',
        );
      }
      inspection = await this.create(
        {
          module: payload.module,
          inspectionScope: payload.inspectionScope,
          checklistId: payload.checklistId,
          teamId: payload.teamId,
          serviceOrderId: payload.serviceOrderId,
          contractId: payload.contractId,
          investmentWorkId: payload.investmentWorkId,
          serviceDescription: payload.serviceDescription,
          locationDescription: payload.locationDescription,
          collaboratorIds: payload.collaboratorIds || [],
          externalId: payload.externalId,
          createdOffline: payload.createdOffline ?? true,
          syncedAt: payload.syncedAt || new Date().toISOString(),
        },
        userId,
        user,
      );
      status = 'CREATED';
    } else {
      if (
        userRole === UserRole.FISCAL &&
        inspection.status !== InspectionStatus.RASCUNHO
      ) {
        throw new ForbiddenException(
          'Fiscal não pode editar vistoria após finalização',
        );
      }

      const nextModule = payload.module ?? inspection.module;
      const nextTeamId = payload.teamId ?? inspection.teamId;
      const nextInspectionScope = this.resolveInspectionScope(
        nextModule,
        payload.inspectionScope ?? inspection.inspectionScope,
      );
      const nextCollaboratorIds =
        payload.collaboratorIds ??
        inspection.collaborators?.map((collaborator) => collaborator.id) ??
        [];
      const hasServiceDescriptionChange = Object.prototype.hasOwnProperty.call(
        payload,
        'serviceDescription',
      );
      const nextServiceDescription = hasServiceDescriptionChange
        ? this.normalizeServiceDescription(payload.serviceDescription)
        : inspection.serviceDescription;

      if (this.isTeamRequired(nextModule) && !nextTeamId) {
        throw new BadRequestException(
          'teamId é obrigatório para módulos diferentes de SEGURANCA_TRABALHO.',
        );
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'teamId') && nextTeamId) {
        await this.assertTeamExists(nextTeamId);
      }

      if (
        this.isServiceDescriptionRequired(nextModule) &&
        !nextServiceDescription
      ) {
        throw new BadRequestException(
          'serviceDescription é obrigatório para módulos diferentes de REMOTO.',
        );
      }

      await this.validateCollaboratorsForContractorTeam(
        nextTeamId,
        nextCollaboratorIds,
      );
      await this.validateInspectionScopeRules(
        nextModule,
        nextInspectionScope,
        nextCollaboratorIds,
      );

      await this.inspectionsRepository.update(inspection.id, {
        module: nextModule,
        inspectionScope: nextInspectionScope,
        checklistId: payload.checklistId ?? inspection.checklistId,
        teamId: nextTeamId,
        investmentWorkId:
          payload.investmentWorkId ?? inspection.investmentWorkId,
        serviceDescription: nextServiceDescription,
        locationDescription:
          payload.locationDescription ?? inspection.locationDescription,
        createdOffline: payload.createdOffline ?? inspection.createdOffline,
        syncedAt: payload.syncedAt ? new Date(payload.syncedAt) : new Date(),
      });

      if (payload.collaboratorIds) {
        await this.validateCollaboratorsForContractorTeam(
          payload.teamId ?? inspection.teamId,
          payload.collaboratorIds,
        );
        const inspectionWithRelations =
          await this.inspectionsRepository.findOne({
            where: { id: inspection.id },
            relations: ['collaborators'],
          });
        if (inspectionWithRelations) {
          const collaboratorRepository =
            this.dataSource.getRepository(Collaborator);
          inspectionWithRelations.collaborators =
            await collaboratorRepository.findBy({
              id: In(payload.collaboratorIds),
            });
          await this.inspectionsRepository.save(inspectionWithRelations);
        }
      }
    }

    if (payload.items?.length) {
      for (const item of payload.items) {
        const existingItem = await this.inspectionItemsRepository.findOne({
          where: {
            inspectionId: inspection.id,
            checklistItemId: item.checklistItemId,
          },
        });

        if (existingItem) {
          await this.inspectionItemsRepository.update(existingItem.id, {
            answer: item.answer,
            notes: item.notes,
          });
        } else {
          const newItem = this.inspectionItemsRepository.create({
            inspectionId: inspection.id,
            checklistItemId: item.checklistItemId,
            answer: item.answer,
            notes: item.notes,
          });
          await this.inspectionItemsRepository.save(newItem);
        }
      }
    }

    if (payload.evidences?.length) {
      for (const evidence of payload.evidences) {
        if (evidence.dataUrl) {
          throw new BadRequestException('Assets must be uploaded before sync');
        }

        const evidenceUrl = evidence.url || evidence.filePath;
        const evidencePublicId = evidence.cloudinaryPublicId || null;

        if (!evidenceUrl && !evidencePublicId) {
          throw new BadRequestException(
            'Evidência inválida: url é obrigatória',
          );
        }

        // Resolver inspectionItemId no servidor: client pode enviar id do app (não existe aqui) ou checklistItemId
        let resolvedInspectionItemId: string | null = null;
        if (evidence.checklistItemId) {
          const item = await this.inspectionItemsRepository.findOne({
            where: {
              inspectionId: inspection.id,
              checklistItemId: evidence.checklistItemId,
            },
          });
          if (item) resolvedInspectionItemId = item.id;
        } else if (evidence.inspectionItemId) {
          const item = await this.inspectionItemsRepository.findOne({
            where: {
              id: evidence.inspectionItemId,
              inspectionId: inspection.id,
            },
          });
          if (item) resolvedInspectionItemId = item.id;
        }

        const normalizedFileName =
          evidence.fileName ||
          (evidencePublicId
            ? evidencePublicId.split('/').pop() || evidencePublicId
            : 'uploaded-image');
        const normalizedMimeType =
          evidence.mimeType ||
          (evidence.format ? `image/${evidence.format}` : 'image/*');
        const normalizedSize = evidence.size ?? evidence.bytes ?? 0;

        const whereCandidates: Array<Record<string, any>> = [];
        if (evidencePublicId) {
          whereCandidates.push({
            inspectionId: inspection.id,
            inspectionItemId: resolvedInspectionItemId,
            cloudinaryPublicId: evidencePublicId,
          });
        }
        if (evidenceUrl) {
          whereCandidates.push({
            inspectionId: inspection.id,
            inspectionItemId: resolvedInspectionItemId,
            url: evidenceUrl,
          });
        }
        whereCandidates.push({
          inspectionId: inspection.id,
          inspectionItemId: resolvedInspectionItemId,
          filePath: evidenceUrl || evidencePublicId || normalizedFileName,
          fileName: normalizedFileName,
          size: normalizedSize,
        });

        const existingEvidence = await this.evidencesRepository.findOne({
          where: whereCandidates,
        });

        if (!existingEvidence) {
          const newEvidence = this.evidencesRepository.create({
            inspectionId: inspection.id,
            inspectionItemId: resolvedInspectionItemId,
            filePath: evidenceUrl || evidencePublicId || normalizedFileName,
            fileName: normalizedFileName,
            mimeType: normalizedMimeType,
            size: normalizedSize,
            cloudinaryPublicId: evidencePublicId,
            url: evidenceUrl,
            bytes: evidence.bytes ?? normalizedSize,
            format: evidence.format || null,
            width: evidence.width || null,
            height: evidence.height || null,
            uploadedByUserId: userId,
          });
          await this.evidencesRepository.save(newEvidence);
        }
      }
    }

    if (payload.signature) {
      await this.upsertSignatureFromSync(inspection.id, payload.signature);
    }

    if (payload.paralyze?.reason !== undefined) {
      const reason = payload.paralyze.reason.trim();
      if (!reason) {
        throw new BadRequestException(
          'Paralisação no sync inválida: reason é obrigatório',
        );
      }
      await this.paralyze(inspection.id, reason, userId);
    }

    if (payload.finalize) {
      await this.finalize(inspection.id);
    } else {
      await this.inspectionsRepository.update(inspection.id, {
        syncedAt: payload.syncedAt ? new Date(payload.syncedAt) : new Date(),
      });
    }

    return {
      externalId: payload.externalId,
      serverId: inspection.id,
      status,
    };
  }

  private async validateCollaboratorsForContractorTeam(
    teamId: string | null,
    collaboratorIds?: string[],
  ): Promise<void> {
    if (!collaboratorIds || collaboratorIds.length === 0) {
      return;
    }

    if (!teamId) {
      return;
    }

    const team = await this.teamsRepository.findOne({
      where: { id: teamId },
      select: ['id', 'isContractor'],
    });

    if (!team) {
      throw new BadRequestException('Equipe não encontrada');
    }

    if (team.isContractor) {
      throw new BadRequestException(
        'Equipe empreiteira não permite vínculo de colaboradores',
      );
    }
  }

  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.teamsRepository.findOne({
      where: { id: teamId },
      select: ['id'],
    });

    if (!team) {
      throw new BadRequestException('Equipe não encontrada');
    }
  }

  private isServiceOrderRequired(module: ModuleType): boolean {
    return (
      module !== ModuleType.SEGURANCA_TRABALHO &&
      module !== ModuleType.OBRAS_INVESTIMENTO
    );
  }

  private isTeamRequired(module: ModuleType): boolean {
    return module !== ModuleType.SEGURANCA_TRABALHO;
  }

  private isServiceDescriptionRequired(module: ModuleType): boolean {
    return module !== ModuleType.REMOTO;
  }

  private normalizeServiceDescription(
    serviceDescription?: string | null,
  ): string | null {
    if (typeof serviceDescription !== 'string') {
      return null;
    }

    const normalized = serviceDescription.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private resolveInspectionScope(
    module: ModuleType,
    inspectionScope?: InspectionScope,
  ): InspectionScope {
    if (module !== ModuleType.SEGURANCA_TRABALHO) {
      return InspectionScope.TEAM;
    }

    return inspectionScope ?? InspectionScope.TEAM;
  }

  private async validateInspectionScopeRules(
    module: ModuleType,
    inspectionScope: InspectionScope,
    collaboratorIds: string[],
  ): Promise<void> {
    if (module !== ModuleType.SEGURANCA_TRABALHO) {
      return;
    }

    if (inspectionScope !== InspectionScope.COLLABORATOR) {
      return;
    }

    if (collaboratorIds.length !== 1) {
      throw new BadRequestException(
        'Vistoria de Segurança do Trabalho por colaborador exige exatamente 1 colaborador.',
      );
    }

    await this.validateCollaboratorsExist(collaboratorIds);
  }

  private async validateCollaboratorsExist(
    collaboratorIds: string[],
  ): Promise<void> {
    if (!collaboratorIds.length) {
      return;
    }

    const collaboratorRepository = this.dataSource.getRepository(Collaborator);
    const uniqueCollaboratorIds = Array.from(new Set(collaboratorIds));
    const existingCollaborators = await collaboratorRepository.findBy({
      id: In(uniqueCollaboratorIds),
    });
    if (existingCollaborators.length !== uniqueCollaboratorIds.length) {
      throw new BadRequestException(
        'Todos os colaboradores informados devem existir na plataforma.',
      );
    }
  }

  private async upsertSignatureFromSync(
    inspectionId: string,
    signaturePayload: SyncSignatureDto,
  ): Promise<void> {
    const existing = await this.signaturesRepository.findOne({
      where: { inspectionId },
    });

    if (signaturePayload.imageBase64 || signaturePayload.dataUrl) {
      throw new BadRequestException('Assets must be uploaded before sync');
    }

    let signatureUrl = signaturePayload.url || signaturePayload.imagePath || '';
    let cloudinaryPublicId = signaturePayload.cloudinaryPublicId || null;

    if (!signatureUrl && existing) {
      signatureUrl = existing.url || existing.imagePath;
    }
    if (!cloudinaryPublicId && existing) {
      cloudinaryPublicId = existing.cloudinaryPublicId;
    }

    if (!signatureUrl) {
      throw new BadRequestException('Assinatura inválida: url é obrigatória');
    }

    if (existing) {
      await this.signaturesRepository.update(existing.id, {
        signerName: signaturePayload.signerName || existing.signerName,
        signerRoleLabel:
          signaturePayload.signerRoleLabel || existing.signerRoleLabel,
        imagePath: signatureUrl,
        cloudinaryPublicId,
        url: signatureUrl,
        signedAt: signaturePayload.signedAt
          ? new Date(signaturePayload.signedAt)
          : existing.signedAt,
      });
      return;
    }

    await this.signaturesRepository.save(
      this.signaturesRepository.create({
        inspectionId,
        signerName: signaturePayload.signerName,
        signerRoleLabel:
          signaturePayload.signerRoleLabel || 'Lider/Encarregado',
        imagePath: signatureUrl,
        cloudinaryPublicId,
        url: signatureUrl,
        signedAt: signaturePayload.signedAt
          ? new Date(signaturePayload.signedAt)
          : new Date(),
      }),
    );
  }

  private base64ToBuffer(base64Value: string): Buffer {
    const sanitizedValue = base64Value.includes(',')
      ? base64Value.split(',').pop() || ''
      : base64Value;

    if (!sanitizedValue) {
      throw new BadRequestException('Assinatura inválida');
    }

    return Buffer.from(sanitizedValue, 'base64');
  }

  /**
   * Aceita resolutionEvidence como URL (recomendado) ou base64.
   * Se for URL (http/https), retorna como está. Caso contrário, faz upload e retorna a URL.
   */
  private async resolutionEvidenceToPath(
    value: string,
  ): Promise<string | null> {
    if (!value?.trim()) return null;
    const trimmed = value.trim();
    if (
      trimmed.toLowerCase().startsWith('http://') ||
      trimmed.toLowerCase().startsWith('https://')
    ) {
      return trimmed;
    }
    const imageBuffer = this.base64ToBuffer(trimmed);
    const uploaded = await this.cloudinaryService.uploadImage(imageBuffer, {
      folder: 'quality/evidences',
    });
    return uploaded.secure_url;
  }

  /**
   * Resolve um item não conforme da vistoria. Quando todos os itens NAO_CONFORME
   * estiverem resolvidos, a vistoria passa automaticamente para RESOLVIDA.
   */
  async resolveItem(
    inspectionId: string,
    itemId: string,
    resolutionData: {
      resolutionNotes: string;
      resolutionEvidence?: string;
    },
    userId: string,
  ): Promise<InspectionItem> {
    const inspection = await this.findOne(inspectionId);

    if (inspection.status !== InspectionStatus.PENDENTE_AJUSTE) {
      throw new BadRequestException('Vistoria não está pendente de ajuste');
    }

    const item = await this.inspectionItemsRepository.findOne({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    if (item.inspectionId !== inspectionId) {
      throw new BadRequestException(
        `O item pertence à vistoria ${item.inspectionId}, não à vistoria informada na URL. Use o id da vistoria correta.`,
      );
    }

    if (item.answer !== ChecklistAnswer.NAO_CONFORME) {
      throw new BadRequestException(
        'Apenas itens em não conformidade podem ser resolvidos',
      );
    }

    const resolutionEvidencePath = await this.resolutionEvidenceToPath(
      resolutionData.resolutionEvidence ?? '',
    );

    item.resolvedAt = new Date();
    item.resolvedByUserId = userId;
    item.resolutionNotes = resolutionData.resolutionNotes;
    item.resolutionEvidencePath = resolutionEvidencePath;
    await this.inspectionItemsRepository.save(item);

    await this.tryMarkInspectionResolvedIfAllItemsResolved(
      inspectionId,
      userId,
    );

    const updated = await this.inspectionItemsRepository.findOne({
      where: { id: itemId },
      relations: ['checklistItem', 'resolvedBy'],
    });
    if (!updated) {
      throw new NotFoundException('Item não encontrado');
    }
    return updated;
  }

  /**
   * Se todos os itens NAO_CONFORME da vistoria tiverem resolvedAt preenchido,
   * marca PendingAdjustment e Inspection como RESOLVIDA.
   */
  private async tryMarkInspectionResolvedIfAllItemsResolved(
    inspectionId: string,
    lastResolvedByUserId: string,
  ): Promise<void> {
    const nonConformItems = await this.inspectionItemsRepository.find({
      where: { inspectionId, answer: ChecklistAnswer.NAO_CONFORME },
    });

    const allResolved = nonConformItems.every((i) => i.resolvedAt != null);
    if (!allResolved || nonConformItems.length === 0) {
      return;
    }

    let pending = await this.pendingAdjustmentsRepository.findOne({
      where: { inspectionId },
    });
    if (!pending) {
      pending = this.pendingAdjustmentsRepository.create({
        inspectionId,
      });
    }
    pending.status = PendingStatus.RESOLVIDA;
    pending.resolvedAt = new Date();
    pending.resolvedByUserId = lastResolvedByUserId;
    await this.pendingAdjustmentsRepository.save(pending);

    await this.inspectionsRepository.update(inspectionId, {
      status: InspectionStatus.RESOLVIDA,
    });
  }

  private async syncPendingAdjustmentByStatus(
    inspectionId: string,
    module: ModuleType,
    nextStatus: InspectionStatus,
    userId: string,
  ): Promise<void> {
    if (
      module === ModuleType.SEGURANCA_TRABALHO ||
      module === ModuleType.REMOTO
    ) {
      return;
    }

    if (
      nextStatus !== InspectionStatus.PENDENTE_AJUSTE &&
      nextStatus !== InspectionStatus.FINALIZADA
    ) {
      return;
    }

    let pending = await this.pendingAdjustmentsRepository.findOne({
      where: { inspectionId },
    });

    if (!pending) {
      pending = this.pendingAdjustmentsRepository.create({ inspectionId });
    }

    if (nextStatus === InspectionStatus.PENDENTE_AJUSTE) {
      pending.status = PendingStatus.PENDENTE;
      pending.resolvedAt = null;
      pending.resolvedByUserId = null;
      pending.resolutionNotes = null;
      pending.resolutionEvidencePath = null;
    } else {
      pending.status = PendingStatus.RESOLVIDA;
      pending.resolvedAt = new Date();
      pending.resolvedByUserId = userId;
    }

    await this.pendingAdjustmentsRepository.save(pending);
  }

  private async calculateFinalScorePercent(
    inspectionId: string,
    hasParalysisPenalty: boolean,
  ): Promise<number> {
    const baseScorePercent = await this.calculateScorePercent(inspectionId);
    return this.inspectionDomainService.applyParalysisPenalty(
      baseScorePercent,
      hasParalysisPenalty,
    );
  }

  /**
   * Resolve a vistoria inteira. Só é permitido quando todos os itens não conformes
   * já foram resolvidos individualmente (resolvedAt preenchido).
   */
  async resolve(
    id: string,
    resolutionData: {
      resolutionNotes: string;
      resolutionEvidence?: string;
    },
    userId: string,
  ): Promise<Inspection> {
    const inspection = await this.findOne(id);

    if (inspection.status !== InspectionStatus.PENDENTE_AJUSTE) {
      throw new BadRequestException('Vistoria não está pendente de ajuste');
    }

    const nonConformItems = await this.inspectionItemsRepository.find({
      where: { inspectionId: id, answer: ChecklistAnswer.NAO_CONFORME },
    });

    const pendingItems = nonConformItems.filter((i) => i.resolvedAt == null);
    if (pendingItems.length > 0) {
      throw new BadRequestException(
        'Resolva todos os itens não conformes antes de resolver a vistoria. Use POST /inspections/:id/items/:itemId/resolve para cada item.',
      );
    }

    const resolutionEvidencePath = await this.resolutionEvidenceToPath(
      resolutionData.resolutionEvidence ?? '',
    );

    const inspectionId = inspection.id;

    let pending = await this.pendingAdjustmentsRepository.findOne({
      where: { inspectionId },
    });

    if (!pending) {
      pending = this.pendingAdjustmentsRepository.create({
        inspectionId,
      });
    }

    pending.status = PendingStatus.RESOLVIDA;
    pending.resolvedAt = new Date();
    pending.resolvedByUserId = userId;
    pending.resolutionNotes = resolutionData.resolutionNotes;
    pending.resolutionEvidencePath = resolutionEvidencePath;

    await this.pendingAdjustmentsRepository.save(pending);

    await this.inspectionsRepository.update(inspectionId, {
      status: InspectionStatus.RESOLVIDA,
    });
    this.logger.log('Inspection resolved', {
      inspectionId,
      resolvedByUserId: userId,
    });

    return this.findOne(inspectionId);
  }
}
