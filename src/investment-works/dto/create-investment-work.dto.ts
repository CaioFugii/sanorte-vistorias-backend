import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { InvestmentWorkStatus } from '../../common/enums';

export class CreateInvestmentWorkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  expectedEndDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  district: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  basin: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  service: string;

  @IsUUID('4')
  teamId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  materialNetwork: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  singularities?: string;

  @IsUUID('4')
  contractId: string;

  @IsOptional()
  @IsEnum(InvestmentWorkStatus, {
    message: `status must be one of: ${Object.values(InvestmentWorkStatus).join(', ')}`,
  })
  status?: InvestmentWorkStatus;
}
