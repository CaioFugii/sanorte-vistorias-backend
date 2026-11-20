import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { InvestmentWorkImportLine } from './investment-work-import-line.entity';
import { User } from './user.entity';

@Entity('investment_work_imports')
export class InvestmentWorkImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract, { nullable: false })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'original_file_name' })
  originalFileName: string;

  @Column({ name: 'storage_key' })
  storageKey: string;

  @Column({ name: 'storage_provider' })
  storageProvider: string;

  @Column({ name: 'selected_descriptions', type: 'jsonb' })
  selectedDescriptions: string[];

  @Column({ name: 'created_count', type: 'int' })
  createdCount: number;

  @Column({ name: 'ignored_count', type: 'int' })
  ignoredCount: number;

  @Column({ name: 'not_selected_count', type: 'int' })
  notSelectedCount: number;

  @Column({ name: 'not_registered_count', type: 'int' })
  notRegisteredCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => InvestmentWorkImportLine, (line) => line.import)
  lines: InvestmentWorkImportLine[];
}
