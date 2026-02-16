import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ModuleType } from '../common/enums';
import { ChecklistItem } from './checklist-item.entity';
import { Inspection } from './inspection.entity';
import { ChecklistSection } from './checklist-section.entity';

@Entity('checklists')
export class Checklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ModuleType,
  })
  module: ModuleType;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ChecklistItem, (item) => item.checklist)
  items: ChecklistItem[];

  @OneToMany(() => ChecklistSection, (section) => section.checklist)
  sections: ChecklistSection[];

  @OneToMany(() => Inspection, (inspection) => inspection.checklist)
  inspections: Inspection[];
}
