import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  contractIds: string[];
}
