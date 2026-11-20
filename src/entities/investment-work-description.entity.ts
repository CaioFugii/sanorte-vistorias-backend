import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { InvestmentWorkImport } from './investment-work-import.entity';
import { InvestmentWork } from './investment-work.entity';

@Entity('investment_work_descriptions')
export class InvestmentWorkDescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'investment_work_id', type: 'uuid', nullable: true })
  investmentWorkId: string | null;

  @ManyToOne(() => InvestmentWork, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'investment_work_id' })
  investmentWork: InvestmentWork | null;

  @Column({ name: 'import_id' })
  importId: string;

  @ManyToOne(() => InvestmentWorkImport, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'import_id' })
  import: InvestmentWorkImport;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'os_number' })
  osNumber: string;

  @Column({ name: 'execution_date', type: 'date' })
  executionDate: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'description_key', type: 'text' })
  descriptionKey: string;
}
