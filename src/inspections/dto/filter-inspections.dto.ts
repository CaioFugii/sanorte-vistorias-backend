import { IsOptional, IsEnum, IsUUID, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleType, InspectionStatus } from '../../common/enums';
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
  @IsUUID('4', { message: 'teamId must be a valid UUID' })
  teamId?: string;

  @IsOptional()
  @IsEnum(InspectionStatus, {
    message: `status must be one of: ${Object.values(InspectionStatus).join(', ')}`,
  })
  status?: InspectionStatus;
}
