import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateForemanDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
