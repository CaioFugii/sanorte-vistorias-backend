import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ParalyzeInspectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
