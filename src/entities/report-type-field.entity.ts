import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReportFieldType } from '../common/enums';
import { ReportType } from './report-type.entity';

@Entity('report_type_fields')
export class ReportTypeField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_type_id' })
  reportTypeId: string;

  @ManyToOne(() => ReportType, (reportType) => reportType.fields, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'report_type_id' })
  reportType: ReportType;

  @Column({ name: 'field_key' })
  fieldKey: string;

  @Column()
  label: string;

  @Column({
    type: 'enum',
    enum: ReportFieldType,
    enumName: 'report_field_type_enum',
  })
  type: ReportFieldType;

  @Column({ default: false })
  required: boolean;

  @Column({ name: 'order', type: 'integer' })
  order: number;

  @Column({ type: 'text', nullable: true })
  placeholder: string | null;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText: string | null;

  @Column({ type: 'jsonb', nullable: true })
  options: unknown | null;

  @Column({ name: 'default_value', type: 'text', nullable: true })
  defaultValue: string | null;

  @Column({ default: false })
  multiple: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
