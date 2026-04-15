import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ModuleType } from '../../common/enums';

export class DashboardQueryDto {
  @IsNotEmpty({ message: 'from é obrigatório' })
  @IsDateString(
    {},
    { message: 'from deve ser uma data válida (ex: YYYY-MM-DD)' },
  )
  from: string;

  @IsNotEmpty({ message: 'to é obrigatório' })
  @IsDateString({}, { message: 'to deve ser uma data válida (ex: YYYY-MM-DD)' })
  to: string;

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
