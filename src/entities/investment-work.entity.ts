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
import { InvestmentWorkOrigin, InvestmentWorkStatus } from '../common/enums';
import { Contract } from './contract.entity';
import { InvestmentWorkImport } from './investment-work-import.entity';
import { User } from './user.entity';
import { Team } from './team.entity';
import { Sector } from './sector.entity';
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

  @Column({
    type: 'enum',
    enum: InvestmentWorkOrigin,
    enumName: 'investment_work_origin_enum',
    default: InvestmentWorkOrigin.MANUAL,
  })
  origin: InvestmentWorkOrigin;

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

  @Column({ name: 'pda_team_name', type: 'text', nullable: true })
  pdaTeamName: string | null;

  @Column({ name: 'sector_id', type: 'uuid', nullable: true })
  sectorId: string | null;

  @ManyToOne(() => Sector, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector | null;

  @Column({ name: 'import_id', type: 'uuid', nullable: true })
  importId: string | null;

  @ManyToOne(() => InvestmentWorkImport, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_id' })
  import: InvestmentWorkImport | null;

  @Column({ type: 'text', nullable: true })
  basin: string | null;

  @Column({ type: 'text', nullable: true })
  service: string | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ name: 'material_network', type: 'text', nullable: true })
  materialNetwork: string | null;

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
