import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { InvestmentWorkStatus } from '../../common/enums';

export class UpdateInvestmentWorkDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  workName?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  basin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  service?: string;

  @IsOptional()
  @IsUUID('4')
  teamId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  materialNetwork?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  singularities?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsEnum(InvestmentWorkStatus, {
    message: `status must be one of: ${Object.values(InvestmentWorkStatus).join(', ')}`,
  })
  status?: InvestmentWorkStatus;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
