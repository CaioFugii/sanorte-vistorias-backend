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
import { InvestmentWorkStatus } from '../common/enums';
import { Contract } from './contract.entity';
import { User } from './user.entity';
import { Team } from './team.entity';
import { Inspection } from './inspection.entity';

@Entity('investment_works')
export class InvestmentWork {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract, { nullable: false })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @Column({ name: 'work_name' })
  workName: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'expected_end_date', type: 'date' })
  expectedEndDate: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'text' })
  district: string;

  @Column({ type: 'text' })
  basin: string;

  @Column({ type: 'text' })
  service: string;

  @Column({ name: 'team_id' })
  teamId: string;

  @ManyToOne(() => Team, { nullable: false })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'material_network', type: 'text' })
  materialNetwork: string;

  @Column({ type: 'text', nullable: true })
  singularities: string | null;

  @Column({
    type: 'enum',
    enum: InvestmentWorkStatus,
    default: InvestmentWorkStatus.EM_ANDAMENTO,
  })
  status: InvestmentWorkStatus;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Inspection, (inspection) => inspection.investmentWork)
  inspections: Inspection[];
}
