import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ReportTypeField } from './report-type-field.entity';
import { ReportRecord } from './report-record.entity';

@Entity('report_types')
export class ReportType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ReportTypeField, (field) => field.reportType)
  fields: ReportTypeField[];

  @OneToMany(() => ReportRecord, (record) => record.reportType)
  records: ReportRecord[];
}
