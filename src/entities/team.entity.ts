import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Collaborator } from './collaborator.entity';
import { Inspection } from './inspection.entity';
import { Contract } from './contract.entity';
import { InvestmentWork } from './investment-work.entity';
import { Sector } from './sector.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'is_contractor', default: false })
  isContractor: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Collaborator, (collaborator) => collaborator.teams)
  @JoinTable({
    name: 'team_collaborators',
    joinColumn: { name: 'team_id' },
    inverseJoinColumn: { name: 'collaborator_id' },
  })
  collaborators: Collaborator[];

  /** Preenchido só na listagem (`GET /teams`), sem hidratar `collaborators`. */
  collaboratorCount?: number;

  @OneToMany(() => Inspection, (inspection) => inspection.team)
  inspections: Inspection[];

  @OneToMany(() => InvestmentWork, (investmentWork) => investmentWork.team)
  investmentWorks: InvestmentWork[];

  @ManyToMany(() => Contract, (contract) => contract.teams)
  @JoinTable({
    name: 'team_contracts',
    joinColumn: { name: 'team_id' },
    inverseJoinColumn: { name: 'contract_id' },
  })
  contracts: Contract[];

  @ManyToMany(() => Sector, (sector) => sector.teams)
  @JoinTable({
    name: 'team_sectors',
    joinColumn: { name: 'team_id' },
    inverseJoinColumn: { name: 'sector_id' },
  })
  sectors: Sector[];
}
