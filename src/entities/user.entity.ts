import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { UserRole } from '../common/enums';
import { AccessProfile } from './access-profile.entity';
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

  @Column({ name: 'access_profile_id', type: 'uuid', nullable: true })
  accessProfileId: string | null;

  @ManyToOne(() => AccessProfile, (accessProfile) => accessProfile.users, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'access_profile_id' })
  accessProfile: AccessProfile | null;

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
