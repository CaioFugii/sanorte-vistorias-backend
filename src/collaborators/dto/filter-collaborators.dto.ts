import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class FilterCollaboratorsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'sectorId must be a valid UUID' })
  sectorId?: string;
}
