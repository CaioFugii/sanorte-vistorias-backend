import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class FilterUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'contractId deve ser um UUID válido' })
  contractId?: string;
}
