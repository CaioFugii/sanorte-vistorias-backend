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

@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'checklist_id' })
  checklistId: string;

  @ManyToOne(() => Checklist, (checklist) => checklist.items)
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

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
