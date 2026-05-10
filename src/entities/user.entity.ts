import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { UserRole } from '../common/enums';
import { Inspection } from './inspection.entity';
import { Contract } from './contract.entity';
import { InvestmentWork } from './investment-work.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Inspection, (inspection) => inspection.createdBy)
  inspections: Inspection[];

  @OneToMany(() => InvestmentWork, (investmentWork) => investmentWork.createdBy)
  investmentWorks: InvestmentWork[];

  @ManyToMany(() => Contract, (contract) => contract.users)
  @JoinTable({
    name: 'user_contracts',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'contract_id' },
  })
  contracts: Contract[];
}
