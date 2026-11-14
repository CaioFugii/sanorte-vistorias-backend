import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FieldSupervisor } from './field-supervisor.entity';
import { Team } from './team.entity';

@Entity('foremen')
export class Foreman {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'field_supervisor_id', type: 'uuid', nullable: true })
  fieldSupervisorId: string | null;

  @ManyToOne(() => FieldSupervisor, (fieldSupervisor) => fieldSupervisor.foremen, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'field_supervisor_id' })
  fieldSupervisor: FieldSupervisor | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Team, (team) => team.foreman)
  teams: Team[];
}
