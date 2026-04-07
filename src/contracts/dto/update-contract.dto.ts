import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
