import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class FilterServiceOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  osNumber?: string;

  @IsOptional()
  @IsUUID('4', { message: 'sectorId must be a valid UUID' })
  sectorId?: string;
}
