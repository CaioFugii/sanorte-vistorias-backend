import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Collaborator } from './collaborator.entity';
import { Checklist } from './checklist.entity';

@Entity('sectors')
export class Sector {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Collaborator, (collaborator) => collaborator.sector)
  collaborators: Collaborator[];

  @OneToMany(() => Checklist, (checklist) => checklist.sector)
  checklists: Checklist[];
}
