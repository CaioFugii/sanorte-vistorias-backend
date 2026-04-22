import { IsObject, IsString } from 'class-validator';

export class CreateReportRecordDto {
  @IsString()
  reportTypeCode: string;

  @IsObject()
  formData: Record<string, unknown>;
}
