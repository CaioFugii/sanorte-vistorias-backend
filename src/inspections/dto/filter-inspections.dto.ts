import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ModuleType,
  InspectionStatus,
  InspectionScope,
} from '../../common/enums';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class FilterInspectionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @IsOptional()
  @IsEnum(ModuleType, {
    message: `module must be one of: ${Object.values(ModuleType).join(', ')}`,
  })
  module?: ModuleType;

  @IsOptional()
  @IsEnum(InspectionScope, {
    message: `inspectionScope must be one of: ${Object.values(InspectionScope).join(', ')}`,
  })
  inspectionScope?: InspectionScope;

  @IsOptional()
  @IsUUID('4', { message: 'teamId must be a valid UUID' })
  teamId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'createdByUserId must be a valid UUID' })
  createdByUserId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'contractId must be a valid UUID' })
  contractId?: string;

  @IsOptional()
  @IsDateString()
  executionFrom?: string;

  @IsOptional()
  @IsDateString()
  executionTo?: string;

  @IsOptional()
  @IsDateString()
  inspectionFrom?: string;

  @IsOptional()
  @IsDateString()
  inspectionTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  service?: string;

  @IsOptional()
  @IsEnum(InspectionStatus, {
    message: `status must be one of: ${Object.values(InspectionStatus).join(', ')}`,
  })
  status?: InspectionStatus;

  @IsOptional()
  @IsString()
  osNumber?: string;

  @IsOptional()
  @IsUUID('4', { message: 'investmentWorkId must be a valid UUID' })
  investmentWorkId?: string;
}
