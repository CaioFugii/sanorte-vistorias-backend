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

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

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

  @OneToMany(() => Inspection, (inspection) => inspection.team)
  inspections: Inspection[];
}
