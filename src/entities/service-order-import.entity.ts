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
import { ServiceOrderImportLine } from './service-order-import-line.entity';
import { User } from './user.entity';

@Entity('service_order_imports')
export class ServiceOrderImport {
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

  @Column({ name: 'inserted_count', type: 'int' })
  insertedCount: number;

  @Column({ name: 'skipped_count', type: 'int' })
  skippedCount: number;

  @Column({ name: 'deleted_count', type: 'int' })
  deletedCount: number;

  @Column({ name: 'not_registered_count', type: 'int' })
  notRegisteredCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ServiceOrderImportLine, (line) => line.import)
  lines: ServiceOrderImportLine[];
}
