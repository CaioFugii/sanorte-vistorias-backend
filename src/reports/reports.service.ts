import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportType, ReportTypeField } from '../entities';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ReportType)
    private readonly reportTypesRepository: Repository<ReportType>,
    @InjectRepository(ReportTypeField)
    private readonly reportTypeFieldsRepository: Repository<ReportTypeField>,
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
        orientation: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findTypeFields(code: string): Promise<ReportTypeField[]> {
    const reportType = await this.findReportTypeOrFail(code);
    const fields = await this.reportTypeFieldsRepository.find({
      where: { reportTypeId: reportType.id },
      order: { order: 'ASC' },
    });
    this.logger.log('Report type fields fetched', {
      reportTypeCode: code.trim(),
      reportTypeId: reportType.id,
      fieldsCount: fields.length,
    });
    return fields;
  }

  private async findReportTypeOrFail(code: string): Promise<ReportType> {
    const reportType = await this.reportTypesRepository.findOne({
      where: { code: code.trim(), active: true },
    });
    if (!reportType) {
      throw new NotFoundException(
        'Tipo de relatório não encontrado ou inativo',
      );
    }
    return reportType;
  }
}
