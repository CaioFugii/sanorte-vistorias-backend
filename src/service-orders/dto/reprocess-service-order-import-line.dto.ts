import { IsObject } from 'class-validator';

export class ReprocessServiceOrderImportLineDto {
  @IsObject()
  row: Record<string, unknown>;
}
