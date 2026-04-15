import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ModuleType } from '../../common/enums';

export class CurrentMonthByServiceQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month deve estar no formato YYYY-MM',
  })
  month?: string;

  @IsOptional()
  @IsEnum(ModuleType, {
    message: `module deve ser um dos: ${Object.values(ModuleType).join(', ')}`,
  })
  module?: ModuleType;

  @IsOptional()
  @IsUUID('4', { message: 'teamId deve ser um UUID válido' })
  teamId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'contractId deve ser um UUID válido' })
  contractId?: string;
}
