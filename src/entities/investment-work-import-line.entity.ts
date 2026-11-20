import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvestmentWorkImportLineStatus } from '../common/enums';
import { InvestmentWorkImport } from './investment-work-import.entity';

@Entity('investment_work_import_lines')
export class InvestmentWorkImportLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'import_id' })
  importId: string;

  @ManyToOne(() => InvestmentWorkImport, (item) => item.lines, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'import_id' })
  import: InvestmentWorkImport;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber: number;

  @Column({ type: 'varchar' })
  status: InvestmentWorkImportLineStatus;

  @Column({ name: 'os_number', type: 'varchar', nullable: true })
  osNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'raw_row', type: 'jsonb' })
  rawRow: Record<string, unknown>;
}
