import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class FilterCollaboratorsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'sectorId must be a valid UUID' })
  sectorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'contractId must be a valid UUID' })
  contractId?: string;
}
