import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { InspectionScope, ModuleType } from '../../common/enums';

export class CreateInspectionDto {
  @IsEnum(ModuleType, { message: 'module deve ser um tipo válido' })
  module: ModuleType;

  @IsUUID('4', { message: 'checklistId deve ser um UUID válido' })
  checklistId: string;

  @ValidateIf((o: CreateInspectionDto) => !!o.teamId)
  @IsUUID('4', { message: 'teamId deve ser um UUID válido' })
  @ValidateIf((o: CreateInspectionDto) => o.module !== ModuleType.SEGURANCA_TRABALHO)
  @IsNotEmpty({
    message: 'teamId é obrigatório para criar uma nova vistoria.',
  })
  teamId?: string;

  @IsOptional()
  @IsEnum(InspectionScope, {
    message: 'inspectionScope deve ser TEAM ou COLLABORATOR',
  })
  inspectionScope?: InspectionScope;

  @ValidateIf((o: CreateInspectionDto) => !!o.serviceOrderId)
  @IsUUID('4', {
    message:
      'serviceOrderId é obrigatório. Informe o ID de uma OS cadastrada na tabela de ordens de serviço.',
  })
  @ValidateIf((o: CreateInspectionDto) => o.module !== ModuleType.SEGURANCA_TRABALHO)
  @IsNotEmpty({
    message: 'serviceOrderId é obrigatório para criar uma nova vistoria.',
  })
  serviceOrderId?: string;

  @IsString()
  @IsNotEmpty({ message: 'serviceDescription é obrigatório' })
  @MaxLength(2000)
  serviceDescription: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  locationDescription?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  collaboratorIds?: string[];
}
