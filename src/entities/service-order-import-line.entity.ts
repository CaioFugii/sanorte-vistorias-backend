import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ServiceOrderImportLineStatus } from '../common/enums';
import { ServiceOrderImport } from './service-order-import.entity';

@Entity('service_order_import_lines')
export class ServiceOrderImportLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'import_id' })
  importId: string;

  @ManyToOne(() => ServiceOrderImport, (item) => item.lines, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'import_id' })
  import: ServiceOrderImport;

  @Column({ name: 'line_number', type: 'int' })
  lineNumber: number;

  @Column()
  status: ServiceOrderImportLineStatus;

  @Column({ name: 'os_number', type: 'varchar', nullable: true })
  osNumber: string | null;

  @Column({ name: 'sector_name', type: 'varchar', nullable: true })
  sectorName: string | null;

  @Column({ type: 'varchar', nullable: true })
  resultado: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'raw_row', type: 'jsonb' })
  rawRow: Record<string, string>;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'service_order_id', type: 'uuid', nullable: true })
  serviceOrderId: string | null;

  @Column({ name: 'created_new', type: 'boolean', nullable: true })
  createdNew: boolean | null;

  @Column({ name: 'removed_at', type: 'timestamp', nullable: true })
  removedAt: Date | null;
}
