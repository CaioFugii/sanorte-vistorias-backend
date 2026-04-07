import { IsString, MaxLength } from 'class-validator';

export class CreateContractDto {
  @IsString()
  @MaxLength(120)
  name: string;
}
