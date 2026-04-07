import { IsString, MaxLength } from 'class-validator';

export class CreateCityDto {
  @IsString()
  @MaxLength(120)
  name: string;
}
