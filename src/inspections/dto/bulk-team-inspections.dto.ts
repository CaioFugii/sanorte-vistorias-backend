import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkTeamInspectionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  inspectionIds: string[];

  @IsUUID('4')
  teamId: string;
}
