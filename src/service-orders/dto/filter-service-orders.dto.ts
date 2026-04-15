import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const toBoolean = (value: unknown): boolean | undefined => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class FilterServiceOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  osNumber?: string;

  @IsOptional()
  @IsUUID('4', { message: 'contractId must be a valid UUID' })
  contractId?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'from must be a valid ISO8601 date (YYYY-MM-DD or datetime)' },
  )
  from?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'to must be a valid ISO8601 date (YYYY-MM-DD or datetime)' },
  )
  to?: string;

  @IsOptional()
  @IsUUID('4', { message: 'sectorId must be a valid UUID' })
  sectorId?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'field must be true or false' })
  field?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'remote must be true or false' })
  remote?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'postWork must be true or false' })
  postWork?: boolean;
}
