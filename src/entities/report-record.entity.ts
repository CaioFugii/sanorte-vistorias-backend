import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ReportType } from './report-type.entity';
import { ReportFile } from './report-file.entity';
import { User } from './user.entity';

@Entity('report_records')
export class ReportRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_type_id' })
  reportTypeId: string;

  @ManyToOne(() => ReportType, (reportType) => reportType.records)
  @JoinColumn({ name: 'report_type_id' })
  reportType: ReportType;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'schema_version', type: 'integer', default: 1 })
  schemaVersion: number;

  @Column({ name: 'form_data', type: 'jsonb' })
  formData: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ReportFile, (file: ReportFile) => file.reportRecord)
  files: ReportFile[];
}
