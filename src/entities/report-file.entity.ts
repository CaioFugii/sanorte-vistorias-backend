import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReportRecord } from './report-record.entity';
import { ReportType } from './report-type.entity';
import { User } from './user.entity';

@Entity('report_files')
export class ReportFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_record_id', nullable: true })
  reportRecordId: string | null;

  @ManyToOne(() => ReportRecord, (reportRecord) => reportRecord.files, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'report_record_id' })
  reportRecord: ReportRecord | null;

  @Column({ name: 'report_type_id', nullable: true })
  reportTypeId: string | null;

  @ManyToOne(() => ReportType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'report_type_id' })
  reportType: ReportType | null;

  @Column({ name: 'field_key' })
  fieldKey: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column()
  url: string;

  @Column({ name: 'storage_provider' })
  storageProvider: string;

  @Column({ name: 'storage_key' })
  storageKey: string;

  @Column({ name: 'public_id', nullable: true })
  publicId: string | null;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
