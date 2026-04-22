import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadReportFileDto {
  @IsString()
  reportTypeCode: string;

  @IsString()
  fieldKey: string;

  @IsOptional()
  @IsUUID('4')
  reportRecordId?: string;
}
