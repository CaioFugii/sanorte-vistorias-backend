import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ModuleType } from '../common/enums';
import { ChecklistItem } from './checklist-item.entity';
import { Inspection } from './inspection.entity';
import { ChecklistSection } from './checklist-section.entity';
import { Sector } from './sector.entity';

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

  @Column({ name: 'sector_id', nullable: true })
  sectorId: string;

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

  @ManyToOne(() => Sector, (sector) => sector.checklists, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;
}
