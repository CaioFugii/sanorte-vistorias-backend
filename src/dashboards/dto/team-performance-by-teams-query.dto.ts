import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class TeamPerformanceByTeamsQueryDto {
  @IsNotEmpty({ message: 'from é obrigatório' })
  @IsDateString(
    {},
    { message: 'from deve ser uma data válida (ex: YYYY-MM-DD)' },
  )
  from: string;

  @IsNotEmpty({ message: 'to é obrigatório' })
  @IsDateString({}, { message: 'to deve ser uma data válida (ex: YYYY-MM-DD)' })
  to: string;

  @IsNotEmpty({ message: 'teamIds é obrigatório' })
  @Matches(
    /^[0-9a-fA-F-]{36}(,[0-9a-fA-F-]{36})*$/,
    { message: 'teamIds deve ser uma lista CSV de UUIDs válidos' },
  )
  teamIds: string;

  @IsOptional()
  @IsUUID('4', { message: 'contractId deve ser um UUID válido' })
  contractId?: string;
}
