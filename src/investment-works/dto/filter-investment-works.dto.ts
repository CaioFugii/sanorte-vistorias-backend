import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { InvestmentWorkStatus } from '../../common/enums';

const toBoolean = (value: unknown): boolean | undefined => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class FilterInvestmentWorksDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InvestmentWorkStatus, {
    message: `status must be one of: ${Object.values(InvestmentWorkStatus).join(', ')}`,
  })
  status?: InvestmentWorkStatus;

  @IsOptional()
  @IsUUID('4', { message: 'contractId must be a valid UUID' })
  contractId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'active must be true or false' })
  active?: boolean;
}
