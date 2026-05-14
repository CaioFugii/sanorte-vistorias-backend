import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

export class NonConformitiesByTeamQueryDto extends DashboardQueryDto {
  @IsNotEmpty({ message: 'teamId é obrigatório' })
  @IsUUID('4', { message: 'teamId deve ser um UUID válido' })
  teamId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro' })
  @Min(1, { message: 'limit deve ser maior ou igual a 1' })
  @Max(20, { message: 'limit deve ser menor ou igual a 20' })
  limit?: number;
}
