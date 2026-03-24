import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { InspectionScope, ModuleType } from '../../common/enums';

export class FilterChecklistsDto extends PaginationQueryDto {
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
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'active must be a boolean value (true or false)' })
  active?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'sectorId must be a valid UUID' })
  sectorId?: string;
}
