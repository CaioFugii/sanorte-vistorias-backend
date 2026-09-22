import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SafetyWorkChecklistInspectionsQueryDto {
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
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro' })
  @Min(1, { message: 'page deve ser maior ou igual a 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro' })
  @Min(1, { message: 'limit deve ser maior ou igual a 1' })
  @Max(100, { message: 'limit deve ser menor ou igual a 100' })
  limit?: number = 20;

  @IsOptional()
  @IsUUID('4', { message: 'contractId deve ser um UUID válido' })
  contractId?: string;
}
