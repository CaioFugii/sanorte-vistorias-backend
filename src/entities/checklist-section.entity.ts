import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Checklist } from './checklist.entity';
import { ChecklistItem } from './checklist-item.entity';

@Entity('checklist_sections')
export class ChecklistSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'checklist_id' })
  checklistId: string;

  @ManyToOne(() => Checklist, (checklist) => checklist.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

  @Column()
  name: string;

  @Column()
  order: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ChecklistItem, (item) => item.section)
  items: ChecklistItem[];
}
