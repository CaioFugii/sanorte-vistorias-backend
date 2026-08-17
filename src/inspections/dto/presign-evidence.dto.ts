import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PresignEvidenceDto {
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  contentLength: number;
}
