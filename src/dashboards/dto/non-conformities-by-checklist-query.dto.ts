import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

export class NonConformitiesByChecklistQueryDto extends DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limitPerChecklist deve ser um número inteiro' })
  @Min(1, { message: 'limitPerChecklist deve ser maior ou igual a 1' })
  @Max(20, { message: 'limitPerChecklist deve ser menor ou igual a 20' })
  limitPerChecklist?: number;
}
