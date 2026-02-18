import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolveItemDto {
  @IsString()
  @IsNotEmpty({ message: 'resolutionNotes é obrigatório' })
  resolutionNotes: string;

  @IsOptional()
  @IsString()
  resolutionEvidence?: string;
}
