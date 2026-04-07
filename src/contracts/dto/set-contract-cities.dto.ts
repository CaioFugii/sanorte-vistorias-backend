import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetContractCitiesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  cityIds: string[];
}
