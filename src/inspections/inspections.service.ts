import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
} from '../entities';
import {
  InspectionStatus,
  ChecklistAnswer,
  ModuleType,
  PendingStatus,
  UserRole,
} from '../common/enums';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { InspectionDomainService } from './inspection-domain.service';
import {
  SyncInspectionDto,
  SyncSignatureDto,
} from './dto/sync-inspections.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class InspectionsService {
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
    private cloudinaryService: CloudinaryService,
    private dataSource: DataSource,
    private inspectionDomainService: InspectionDomainService,
  ) {}

  async create(
    inspectionData: {
      module: ModuleType;
      checklistId: string;
      teamId: string;
      serviceDescription: string;
      locationDescription?: string;
      collaboratorIds?: string[];
      externalId?: string;
      createdOffline?: boolean;
      syncedAt?: string;
    },
    userId: string,
  ): Promise<Inspection> {
    const inspection = this.inspectionsRepository.create({
      ...inspectionData,
      createdByUserId: userId,
      status: InspectionStatus.RASCUNHO,
      createdOffline: inspectionData.createdOffline || false,
      syncedAt: inspectionData.syncedAt ? new Date(inspectionData.syncedAt) : null,
    });

    const savedInspection = await this.inspectionsRepository.save(inspection);

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
    if (inspectionData.collaboratorIds && inspectionData.collaboratorIds.length > 0) {
      const inspection = await this.inspectionsRepository.findOne({
        where: { id: savedInspection.id },
        relations: ['collaborators'],
      });
      if (inspection) {
        const collaboratorRepository = this.dataSource.getRepository(Collaborator);
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
      teamId?: string;
      status?: InspectionStatus;
    },
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<Inspection>> {
    const skip = (page - 1) * limit;

    const query = this.inspectionsRepository
      .createQueryBuilder('inspection')
      .leftJoinAndSelect('inspection.checklist', 'checklist')
      .leftJoinAndSelect('inspection.team', 'team')
      .leftJoinAndSelect('inspection.createdBy', 'createdBy')
      .leftJoinAndSelect('inspection.items', 'items')
      .leftJoinAndSelect('items.checklistItem', 'checklistItem')
      .leftJoinAndSelect('checklistItem.section', 'checklistSection')
      .leftJoinAndSelect('inspection.collaborators', 'collaborators');

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
    if (filters.teamId) {
      query.andWhere('inspection.teamId = :teamId', { teamId: filters.teamId });
    }
    if (filters.status) {
      query.andWhere('inspection.status = :status', { status: filters.status });
    }

    query.skip(skip).take(limit).orderBy('inspection.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();

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
  ): Promise<PaginatedResponseDto<Inspection>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.inspectionsRepository.findAndCount({
      where: { createdByUserId: userId },
      relations: [
        'checklist',
        'checklist.sections',
        'checklist.items',
        'checklist.items.section',
        'team',
        'items',
        'items.checklistItem',
        'items.checklistItem.section',
      ],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
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

  async findOne(id: string): Promise<Inspection> {
    const inspection = await this.inspectionsRepository.findOne({
      where: { id },
      relations: [
        'checklist',
        'checklist.items',
        'checklist.items.section',
        'checklist.sections',
        'team',
        'team.collaborators',
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

  async update(
    id: string,
    inspectionData: Partial<Inspection>,
    userId: string,
    userRole: string,
  ): Promise<Inspection> {
    const inspection = await this.findOne(id);

    // FISCAL só pode editar se status = RASCUNHO
    if (userRole === 'FISCAL' && inspection.status !== InspectionStatus.RASCUNHO) {
      throw new ForbiddenException(
        'Fiscal não pode editar vistoria após finalização',
      );
    }

    // GESTOR e ADMIN podem editar sempre
    await this.inspectionsRepository.update(id, inspectionData);
    return this.findOne(id);
  }

  async updateItems(
    id: string,
    items: Array<{ inspectionItemId: string; answer: ChecklistAnswer; notes?: string }>,
  ): Promise<InspectionItem[]> {
    const inspection = await this.findOne(id);

    if (inspection.status !== InspectionStatus.RASCUNHO) {
      throw new BadRequestException(
        'Não é possível atualizar itens de vistoria finalizada',
      );
    }

    const updatedItems = [];
    for (const item of items) {
      await this.inspectionItemsRepository.update(item.inspectionItemId, {
        answer: item.answer,
        notes: item.notes,
      });
      const updated = await this.inspectionItemsRepository.findOne({
        where: { id: item.inspectionItemId },
      });
      if (updated) updatedItems.push(updated);
    }

    return updatedItems;
  }

  async addEvidence(
    id: string,
    file: Express.Multer.File,
    inspectionItemId?: string,
    userId?: string,
  ): Promise<Evidence> {
    const inspection = await this.findOne(id);

    if (inspection.status !== InspectionStatus.RASCUNHO) {
      throw new BadRequestException(
        'Não é possível adicionar evidências em vistoria finalizada',
      );
    }

    const uploaded = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: 'quality/evidences',
    });

    const evidence = this.evidencesRepository.create({
      inspectionId: id,
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
  }

  async addSignature(
    id: string,
    signerName: string,
    imageBase64: string,
  ): Promise<Signature> {
    const inspection = await this.findOne(id);

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
      inspectionId: id,
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
    });
    return this.inspectionDomainService.calculateScorePercent(items);
  }

  async finalize(id: string, userId: string, userRole: string): Promise<Inspection> {
    const inspection = await this.findOne(id);

    if (inspection.status !== InspectionStatus.RASCUNHO) {
      throw new BadRequestException('Vistoria já foi finalizada');
    }

    // Validar assinatura obrigatória
    const signature = await this.signaturesRepository.findOne({
      where: { inspectionId: id },
    });

    if (!signature) {
      throw new BadRequestException(
        'Assinatura do líder/encarregado é obrigatória para finalizar',
      );
    }

    // Validar evidências para itens NAO_CONFORME
    const items = await this.inspectionItemsRepository.find({
      where: { inspectionId: id },
      relations: ['checklistItem', 'evidences'],
    });

    for (const item of items) {
      if (item.answer === ChecklistAnswer.NAO_CONFORME) {
        const checklistItem = await this.checklistItemsRepository.findOne({
          where: { id: item.checklistItemId },
        });

        if (
          checklistItem &&
          checklistItem.requiresPhotoOnNonConformity &&
          (!item.evidences || item.evidences.length === 0)
        ) {
          throw new BadRequestException(
            `Item "${checklistItem.title}" requer foto de evidência quando não conforme`,
          );
        }
      }
    }

    // Calcular percentual
    const scorePercent = await this.calculateScorePercent(id);

    const status = this.inspectionDomainService.resolveFinalStatus(items);
    if (status === InspectionStatus.PENDENTE_AJUSTE) {
      // Criar ou atualizar PendingAdjustment
      let pending = await this.pendingAdjustmentsRepository.findOne({
        where: { inspectionId: id },
      });

      if (!pending) {
        pending = this.pendingAdjustmentsRepository.create({
          inspectionId: id,
          status: PendingStatus.PENDENTE,
        });
      } else {
        pending.status = PendingStatus.PENDENTE;
      }
      await this.pendingAdjustmentsRepository.save(pending);
    }

    // Atualizar vistoria
    await this.inspectionsRepository.update(id, {
      status,
      scorePercent,
      finalizedAt: new Date(),
    });

    return this.findOne(id);
  }

  async syncInspections(
    inspections: SyncInspectionDto[],
    userId: string,
    userRole: UserRole,
  ): Promise<{
    results: Array<{
      externalId: string;
      serverId?: string;
      status: 'CREATED' | 'UPDATED' | 'ERROR';
      message?: string;
    }>;
  }> {
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
        const result = await this.syncSingleInspection(payload, userId, userRole);
        results.push(result);
      } catch (error: any) {
        results.push({
          externalId,
          status: 'ERROR',
          message: error?.message || 'Erro ao sincronizar vistoria',
        });
      }
    }

    return { results };
  }

  private async syncSingleInspection(
    payload: SyncInspectionDto,
    userId: string,
    userRole: UserRole,
  ): Promise<{
    externalId: string;
    serverId: string;
    status: 'CREATED' | 'UPDATED';
  }> {
    if (!payload?.externalId) {
      throw new BadRequestException('externalId é obrigatório para sincronização');
    }

    let inspection = await this.inspectionsRepository.findOne({
      where: { externalId: payload.externalId },
      relations: ['collaborators'],
    });

    let status: 'CREATED' | 'UPDATED' = 'UPDATED';

    if (!inspection) {
      inspection = await this.create(
        {
          module: payload.module,
          checklistId: payload.checklistId,
          teamId: payload.teamId,
          serviceDescription: payload.serviceDescription,
          locationDescription: payload.locationDescription,
          collaboratorIds: payload.collaboratorIds || [],
          externalId: payload.externalId,
          createdOffline: payload.createdOffline ?? true,
          syncedAt: payload.syncedAt || new Date().toISOString(),
        },
        userId,
      );
      status = 'CREATED';
    } else {
      if (userRole === UserRole.FISCAL && inspection.status !== InspectionStatus.RASCUNHO) {
        throw new ForbiddenException(
          'Fiscal não pode editar vistoria após finalização',
        );
      }

      await this.inspectionsRepository.update(inspection.id, {
        module: payload.module ?? inspection.module,
        checklistId: payload.checklistId ?? inspection.checklistId,
        teamId: payload.teamId ?? inspection.teamId,
        serviceDescription: payload.serviceDescription ?? inspection.serviceDescription,
        locationDescription: payload.locationDescription ?? inspection.locationDescription,
        createdOffline: payload.createdOffline ?? inspection.createdOffline,
        syncedAt: payload.syncedAt ? new Date(payload.syncedAt) : new Date(),
      });

      if (payload.collaboratorIds) {
        const inspectionWithRelations = await this.inspectionsRepository.findOne({
          where: { id: inspection.id },
          relations: ['collaborators'],
        });
        if (inspectionWithRelations) {
          const collaboratorRepository = this.dataSource.getRepository(Collaborator);
          inspectionWithRelations.collaborators = await collaboratorRepository.findBy({
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
          throw new BadRequestException('Evidência inválida: url é obrigatória');
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
            inspectionItemId: evidence.inspectionItemId || null,
            cloudinaryPublicId: evidencePublicId,
          });
        }
        if (evidenceUrl) {
          whereCandidates.push({
            inspectionId: inspection.id,
            inspectionItemId: evidence.inspectionItemId || null,
            url: evidenceUrl,
          });
        }
        whereCandidates.push({
          inspectionId: inspection.id,
          inspectionItemId: evidence.inspectionItemId || null,
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
            inspectionItemId: evidence.inspectionItemId,
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

    if (payload.finalize) {
      await this.finalize(inspection.id, userId, userRole);
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
        signerRoleLabel: signaturePayload.signerRoleLabel || existing.signerRoleLabel,
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
        signerRoleLabel: signaturePayload.signerRoleLabel || 'Lider/Encarregado',
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

    let resolutionEvidencePath: string | null = null;
    if (resolutionData.resolutionEvidence) {
      const imageBuffer = this.base64ToBuffer(resolutionData.resolutionEvidence);
      const uploaded = await this.cloudinaryService.uploadImage(imageBuffer, {
        folder: 'quality/evidences',
      });
      resolutionEvidencePath = uploaded.secure_url;
    }

    // Atualizar PendingAdjustment
    let pending = await this.pendingAdjustmentsRepository.findOne({
      where: { inspectionId: id },
    });

    if (!pending) {
      pending = this.pendingAdjustmentsRepository.create({
        inspectionId: id,
      });
    }

    pending.status = PendingStatus.RESOLVIDA;
    pending.resolvedAt = new Date();
    pending.resolvedByUserId = userId;
    pending.resolutionNotes = resolutionData.resolutionNotes;
    pending.resolutionEvidencePath = resolutionEvidencePath;

    await this.pendingAdjustmentsRepository.save(pending);

    // Atualizar status da vistoria
    await this.inspectionsRepository.update(id, {
      status: InspectionStatus.RESOLVIDA,
    });

    return this.findOne(id);
  }
}
