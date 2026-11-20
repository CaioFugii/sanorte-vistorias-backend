import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccessArea } from '../../common/enums';

export class CreateAccessProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(AccessArea, { each: true })
  areas: AccessArea[];
}

export class UpdateAccessProfileDto extends CreateAccessProfileDto {}

export class DuplicateAccessProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}
