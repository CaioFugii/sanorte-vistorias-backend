import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ReportFieldType, UserRole } from '../common/enums';
import { ReportFile, ReportRecord, ReportType, ReportTypeField } from '../entities';
import { CreateReportRecordDto } from './dto/create-report-record.dto';
import { UploadReportFileDto } from './dto/upload-report-file.dto';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ImageReference = {
  id: string;
  url: string;
  storageProvider: string;
  storageKey: string;
  publicId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportType)
    private readonly reportTypesRepository: Repository<ReportType>,
    @InjectRepository(ReportTypeField)
    private readonly reportTypeFieldsRepository: Repository<ReportTypeField>,
    @InjectRepository(ReportRecord)
    private readonly reportRecordsRepository: Repository<ReportRecord>,
    @InjectRepository(ReportFile)
    private readonly reportFilesRepository: Repository<ReportFile>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly dataSource: DataSource,
  ) {}

  async findActiveTypes(): Promise<ReportType[]> {
    return this.reportTypesRepository.find({
      where: { active: true },
      order: { name: 'ASC' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        version: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findTypeFields(code: string): Promise<ReportTypeField[]> {
    const reportType = await this.findReportTypeOrFail(code);
    return this.reportTypeFieldsRepository.find({
      where: { reportTypeId: reportType.id },
      order: { order: 'ASC' },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    dto: UploadReportFileDto,
    userId: string,
  ): Promise<ReportFile> {
    const reportType = await this.findReportTypeOrFail(dto.reportTypeCode);
    const field = await this.reportTypeFieldsRepository.findOne({
      where: { reportTypeId: reportType.id, fieldKey: dto.fieldKey },
    });

    if (!field) {
      throw new BadRequestException('fieldKey inválido para o tipo de relatório');
    }

    if (![ReportFieldType.IMAGE, ReportFieldType.SIGNATURE].includes(field.type)) {
      throw new BadRequestException(
        'Upload permitido apenas para campos do tipo image ou signature',
      );
    }

    if (!file?.path) {
      throw new BadRequestException('Arquivo inválido');
    }

    let reportRecordId: string | null = null;
    if (dto.reportRecordId) {
      const reportRecord = await this.reportRecordsRepository.findOne({
        where: { id: dto.reportRecordId },
      });
      if (!reportRecord) {
        throw new NotFoundException('Registro de relatório não encontrado');
      }
      if (reportRecord.userId !== userId) {
        throw new ForbiddenException('Você não pode anexar arquivo neste relatório');
      }
      if (reportRecord.reportTypeId !== reportType.id) {
        throw new BadRequestException(
          'reportTypeCode não corresponde ao registro de relatório informado',
        );
      }
      reportRecordId = reportRecord.id;
    }

    try {
      const uploaded = await this.cloudinaryService.uploadImageFromPath(file.path, {
        folder:
          field.type === ReportFieldType.SIGNATURE
            ? 'quality/reports/signatures'
            : 'quality/reports/images',
      });

      const reportFile = this.reportFilesRepository.create({
        reportTypeId: reportType.id,
        reportRecordId,
        fieldKey: field.fieldKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: uploaded.bytes,
        url: uploaded.secure_url,
        storageProvider: 'cloudinary',
        storageKey: uploaded.public_id,
        publicId: uploaded.public_id,
        createdBy: userId,
      });

      return this.reportFilesRepository.save(reportFile);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  async createRecord(
    dto: CreateReportRecordDto,
    userId: string,
    userRole: UserRole,
  ): Promise<ReportRecord> {
    const reportType = await this.findReportTypeOrFail(dto.reportTypeCode);
    const fields = await this.reportTypeFieldsRepository.find({
      where: { reportTypeId: reportType.id },
      order: { order: 'ASC' },
    });

    const normalizedFormData = await this.validateAndNormalizeFormData(
      fields,
      dto.formData || {},
      reportType.id,
      userId,
    );

    const usedFileIds = this.extractReferencedFileIds(normalizedFormData, fields);

    const savedRecord = await this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(ReportRecord);
      const fileRepo = manager.getRepository(ReportFile);

      const record = recordRepo.create({
        reportTypeId: reportType.id,
        userId,
        schemaVersion: reportType.version,
        formData: normalizedFormData,
      });

      const createdRecord = await recordRepo.save(record);

      if (usedFileIds.length > 0) {
        await fileRepo.update(
          {
            id: In(usedFileIds),
            createdBy: userId,
            reportRecordId: IsNull(),
          },
          { reportRecordId: createdRecord.id },
        );
      }

      return createdRecord;
    });

    return this.findRecordById(savedRecord.id, userId, userRole);
  }

  async findRecordById(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<ReportRecord> {
    const record = await this.reportRecordsRepository.findOne({
      where: { id },
      relations: ['reportType', 'files'],
    });

    if (!record) {
      throw new NotFoundException('Relatório não encontrado');
    }

    const canReadAny =
      userRole === UserRole.ADMIN || userRole === UserRole.GESTOR;
    if (!canReadAny && record.userId !== userId) {
      throw new ForbiddenException('Você não tem acesso a este relatório');
    }

    return record;
  }

  private async validateAndNormalizeFormData(
    fields: ReportTypeField[],
    formData: Record<string, unknown>,
    reportTypeId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    if (!formData || Array.isArray(formData) || typeof formData !== 'object') {
      throw new BadRequestException('formData deve ser um objeto');
    }

    const allowedKeys = new Set(fields.map((field) => field.fieldKey));
    const payloadKeys = Object.keys(formData);

    for (const key of payloadKeys) {
      if (!allowedKeys.has(key)) {
        throw new BadRequestException(`Campo não permitido no formulário: ${key}`);
      }
    }

    const normalized: Record<string, unknown> = {};
    const imageFieldsByKey = new Map<string, string[]>();

    for (const field of fields) {
      const rawValue = formData[field.fieldKey];
      const hasValue = rawValue !== undefined && rawValue !== null;

      if (!hasValue) {
        if (field.defaultValue !== null && field.defaultValue !== undefined) {
          normalized[field.fieldKey] = field.defaultValue;
          continue;
        }

        if (field.required) {
          throw new BadRequestException(`Campo obrigatório não informado: ${field.fieldKey}`);
        }
        continue;
      }

      const normalizedValue = this.normalizeFieldValue(field, rawValue);
      if (normalizedValue === undefined || normalizedValue === null) {
        if (field.required) {
          throw new BadRequestException(`Campo obrigatório não informado: ${field.fieldKey}`);
        }
        continue;
      }

      normalized[field.fieldKey] = normalizedValue;

      if (
        field.type === ReportFieldType.IMAGE ||
        field.type === ReportFieldType.SIGNATURE
      ) {
        imageFieldsByKey.set(
          field.fieldKey,
          Array.isArray(normalizedValue) ? normalizedValue : [normalizedValue],
        );
      }
    }

    if (imageFieldsByKey.size > 0) {
      const allFileIds = [...new Set([...imageFieldsByKey.values()].flat())];

      const files = await this.reportFilesRepository.find({
        where: {
          id: In(allFileIds),
          reportTypeId,
          createdBy: userId,
          reportRecordId: IsNull(),
        },
      });

      if (files.length !== allFileIds.length) {
        throw new BadRequestException(
          'Um ou mais arquivos de imagem/assinatura são inválidos para este relatório',
        );
      }

      const fileById = new Map(files.map((file) => [file.id, file]));

      for (const [fieldKey, fileIds] of imageFieldsByKey.entries()) {
        const references: ImageReference[] = fileIds.map((fileId) => {
          const file = fileById.get(fileId);
          if (!file || file.fieldKey !== fieldKey) {
            throw new BadRequestException(
              `Arquivo inválido para o campo de imagem: ${fieldKey}`,
            );
          }
          return {
            id: file.id,
            url: file.url,
            storageProvider: file.storageProvider,
            storageKey: file.storageKey,
            publicId: file.publicId,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
          };
        });

        normalized[fieldKey] = references.length === 1 ? references[0] : references;
      }
    }

    return normalized;
  }

  private normalizeFieldValue(
    field: ReportTypeField,
    rawValue: unknown,
  ): unknown | null | undefined {
    if (typeof rawValue === 'string' && rawValue.trim() === '') {
      return null;
    }

    switch (field.type) {
      case ReportFieldType.TEXT:
      case ReportFieldType.TEXTAREA:
        if (typeof rawValue !== 'string') {
          throw new BadRequestException(`Campo ${field.fieldKey} deve ser texto`);
        }
        return rawValue.trim();

      case ReportFieldType.NUMBER: {
        const numericValue =
          typeof rawValue === 'number' ? rawValue : Number(String(rawValue));
        if (!Number.isFinite(numericValue)) {
          throw new BadRequestException(`Campo ${field.fieldKey} deve ser numérico`);
        }
        return numericValue;
      }

      case ReportFieldType.DATE:
        if (typeof rawValue !== 'string') {
          throw new BadRequestException(`Campo ${field.fieldKey} deve ser data`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
          throw new BadRequestException(
            `Campo ${field.fieldKey} deve estar no formato YYYY-MM-DD`,
          );
        }
        return rawValue;

      case ReportFieldType.DATETIME: {
        const parsed = new Date(String(rawValue));
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException(`Campo ${field.fieldKey} deve ser data/hora válida`);
        }
        return parsed.toISOString();
      }

      case ReportFieldType.SELECT:
      case ReportFieldType.RADIO: {
        if (typeof rawValue !== 'string') {
          throw new BadRequestException(`Campo ${field.fieldKey} deve ser texto`);
        }
        this.validateOptionValue(field, rawValue);
        return rawValue;
      }

      case ReportFieldType.CHECKBOX: {
        const optionValues = this.extractOptionValues(field.options);
        if (!optionValues || optionValues.length === 0) {
          if (typeof rawValue !== 'boolean') {
            throw new BadRequestException(`Campo ${field.fieldKey} deve ser booleano`);
          }
          return rawValue;
        }

        if (field.multiple) {
          if (!Array.isArray(rawValue) || rawValue.some((item) => typeof item !== 'string')) {
            throw new BadRequestException(
              `Campo ${field.fieldKey} deve ser uma lista de opções`,
            );
          }
          rawValue.forEach((value) => this.validateOptionValue(field, value));
          return [...new Set(rawValue)];
        }

        if (typeof rawValue !== 'string') {
          throw new BadRequestException(`Campo ${field.fieldKey} deve ser uma opção válida`);
        }
        this.validateOptionValue(field, rawValue);
        return rawValue;
      }

      case ReportFieldType.IMAGE:
      case ReportFieldType.SIGNATURE:
        return this.normalizeFileReferenceValue(field, rawValue);

      default:
        throw new BadRequestException(
          `Tipo de campo não suportado: ${String(field.type)}`,
        );
    }
  }

  private normalizeFileReferenceValue(
    field: ReportTypeField,
    rawValue: unknown,
  ): string | string[] {
    if (field.multiple) {
      if (!Array.isArray(rawValue)) {
        throw new BadRequestException(
          `Campo ${field.fieldKey} deve ser uma lista de IDs de arquivos`,
        );
      }

      const fileIds = rawValue.map((value) => this.assertFileId(value, field.fieldKey));
      if (field.required && fileIds.length === 0) {
        throw new BadRequestException(`Campo obrigatório não informado: ${field.fieldKey}`);
      }
      return [...new Set(fileIds)];
    }

    return this.assertFileId(rawValue, field.fieldKey);
  }

  private assertFileId(rawValue: unknown, fieldKey: string): string {
    if (typeof rawValue !== 'string' || !UUID_V4_REGEX.test(rawValue)) {
      throw new BadRequestException(
        `Campo ${fieldKey} deve conter um ID de arquivo válido (UUID v4)`,
      );
    }
    return rawValue;
  }

  private validateOptionValue(field: ReportTypeField, value: string): void {
    const options = this.extractOptionValues(field.options);
    if (!options || options.length === 0) {
      return;
    }

    if (!options.includes(value)) {
      throw new BadRequestException(
        `Valor inválido para o campo ${field.fieldKey}. Opções válidas: ${options.join(', ')}`,
      );
    }
  }

  private extractOptionValues(options: unknown): string[] | null {
    if (!Array.isArray(options)) {
      return null;
    }

    const values = options
      .map((option) => {
        if (typeof option === 'string') {
          return option;
        }
        if (
          option &&
          typeof option === 'object' &&
          'value' in option &&
          typeof (option as { value: unknown }).value === 'string'
        ) {
          return (option as { value: string }).value;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));

    return values.length > 0 ? values : null;
  }

  private extractReferencedFileIds(
    formData: Record<string, unknown>,
    fields: ReportTypeField[],
  ): string[] {
    const fileIds: string[] = [];
    for (const field of fields) {
      if (
        field.type !== ReportFieldType.IMAGE &&
        field.type !== ReportFieldType.SIGNATURE
      ) {
        continue;
      }

      const value = formData[field.fieldKey];
      if (!value) {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (
            item &&
            typeof item === 'object' &&
            'id' in item &&
            typeof (item as { id: unknown }).id === 'string'
          ) {
            fileIds.push((item as { id: string }).id);
          }
        });
      } else if (
        value &&
        typeof value === 'object' &&
        'id' in value &&
        typeof (value as { id: unknown }).id === 'string'
      ) {
        fileIds.push((value as { id: string }).id);
      }
    }
    return [...new Set(fileIds)];
  }

  private async findReportTypeOrFail(code: string): Promise<ReportType> {
    const reportType = await this.reportTypesRepository.findOne({
      where: { code: code.trim(), active: true },
    });
    if (!reportType) {
      throw new NotFoundException('Tipo de relatório não encontrado ou inativo');
    }
    return reportType;
  }
}
