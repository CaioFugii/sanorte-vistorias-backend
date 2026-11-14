import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { FieldSupervisor } from './field-supervisor.entity';

@Entity('coordinators')
export class Coordinator {
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

  @ManyToMany(() => Contract)
  @JoinTable({
    name: 'coordinator_contracts',
    joinColumn: { name: 'coordinator_id' },
    inverseJoinColumn: { name: 'contract_id' },
  })
  contracts: Contract[];

  @OneToMany(() => FieldSupervisor, (fieldSupervisor) => fieldSupervisor.coordinator)
  fieldSupervisors: FieldSupervisor[];
}
