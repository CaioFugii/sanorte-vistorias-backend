import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { Coordinator } from './coordinator.entity';
import { Foreman } from './foreman.entity';

@Entity('field_supervisors')
export class FieldSupervisor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'coordinator_id', type: 'uuid' })
  coordinatorId: string;

  @ManyToOne(() => Coordinator, (coordinator) => coordinator.fieldSupervisors, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'coordinator_id' })
  coordinator: Coordinator;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Contract)
  @JoinTable({
    name: 'field_supervisor_contracts',
    joinColumn: { name: 'field_supervisor_id' },
    inverseJoinColumn: { name: 'contract_id' },
  })
  contracts: Contract[];

  @OneToMany(() => Foreman, (foreman) => foreman.fieldSupervisor)
  foremen: Foreman[];
}
