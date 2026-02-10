import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
} from '../common/enums';
import { FilesService } from '../files/files.service';
import { DataSource } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

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
    private filesService: FilesService,
    private dataSource: DataSource,
  ) {}

  async create(
    inspectionData: {
      module: ModuleType;
      checklistId: string;
      teamId: string;
      serviceDescription: string;
      locationDescription?: string;
      collaboratorIds?: string[];
    },
    userId: string,
  ): Promise<Inspection> {
    const inspection = this.inspectionsRepository.create({
      ...inspectionData,
      createdByUserId: userId,
      status: InspectionStatus.RASCUNHO,
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
      relations: ['checklist', 'team', 'items', 'items.checklistItem'],
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
        'team',
        'team.collaborators',
        'createdBy',
        'items',
        'items.checklistItem',
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

    const fileData = await this.filesService.saveEvidence(
      file,
      id,
      inspectionItemId,
    );

    const evidence = this.evidencesRepository.create({
      inspectionId: id,
      inspectionItemId,
      ...fileData,
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

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const imagePath = await this.filesService.saveSignature(
      imageBuffer,
      id,
      'image/png',
    );

    const signature = this.signaturesRepository.create({
      inspectionId: id,
      signerName,
      signerRoleLabel: 'Lider/Encarregado',
      imagePath,
      signedAt: new Date(),
    });

    return this.signaturesRepository.save(signature);
  }

  async calculateScorePercent(inspectionId: string): Promise<number> {
    const items = await this.inspectionItemsRepository.find({
      where: { inspectionId },
    });

    const evaluatedItems = items.filter(
      (item) => item.answer && item.answer !== ChecklistAnswer.NAO_APLICAVEL,
    );

    if (evaluatedItems.length === 0) {
      return 100; // Decisão prática: se não há itens avaliados, retorna 100
    }

    const conformeCount = evaluatedItems.filter(
      (item) => item.answer === ChecklistAnswer.CONFORME,
    ).length;

    return (conformeCount / evaluatedItems.length) * 100;
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

    // Verificar se há itens NAO_CONFORME
    const hasNonConformity = items.some(
      (item) => item.answer === ChecklistAnswer.NAO_CONFORME,
    );

    let status = InspectionStatus.FINALIZADA;
    if (hasNonConformity) {
      status = InspectionStatus.PENDENTE_AJUSTE;
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
      const imageBuffer = Buffer.from(resolutionData.resolutionEvidence, 'base64');
      resolutionEvidencePath = await this.filesService.saveSignature(
        imageBuffer,
        id,
        'image/png',
      );
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
