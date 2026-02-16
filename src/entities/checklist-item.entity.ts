import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Checklist } from './checklist.entity';
import { InspectionItem } from './inspection-item.entity';
import { ChecklistSection } from './checklist-section.entity';

@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'checklist_id' })
  checklistId: string;

  @ManyToOne(() => Checklist, (checklist) => checklist.items)
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

  @Column({ name: 'section_id' })
  sectionId: string;

  @ManyToOne(() => ChecklistSection, (section) => section.items)
  @JoinColumn({ name: 'section_id' })
  section: ChecklistSection;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  order: number;

  @Column({
    name: 'requires_photo_on_non_conformity',
    default: true,
  })
  requiresPhotoOnNonConformity: boolean;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => InspectionItem, (inspectionItem) => inspectionItem.checklistItem)
  inspectionItems: InspectionItem[];
}
