import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { Inspection } from './inspection.entity';
import { Sector } from './sector.entity';
import { Contract } from './contract.entity';

@Entity('collaborators')
export class Collaborator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'sector_id', nullable: true })
  sectorId: string;

  @Column({ name: 'contract_id', nullable: true })
  contractId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Team, (team) => team.collaborators)
  teams: Team[];

  @ManyToMany(() => Inspection, (inspection) => inspection.collaborators)
  inspections: Inspection[];

  @ManyToOne(() => Sector, (sector) => sector.collaborators, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @ManyToOne(() => Contract, (contract) => contract.collaborators, {
    nullable: true,
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract | null;
}
