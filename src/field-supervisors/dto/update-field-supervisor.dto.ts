import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateFieldSupervisorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsUUID('4')
  coordinatorId: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  contractIds: string[];
}
