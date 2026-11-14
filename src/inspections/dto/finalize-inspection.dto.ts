import { IsBoolean, IsOptional } from 'class-validator';

export class FinalizeInspectionDto {
  @IsOptional()
  @IsBoolean()
  generatePending?: boolean;
}
