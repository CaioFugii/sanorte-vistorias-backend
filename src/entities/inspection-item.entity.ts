import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ChecklistAnswer } from '../common/enums';
import { Inspection } from './inspection.entity';
import { ChecklistItem } from './checklist-item.entity';
import { Evidence } from './evidence.entity';
import { User } from './user.entity';

@Entity('inspection_items')
export class InspectionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inspection_id' })
  inspectionId: string;

  @ManyToOne(() => Inspection, (inspection) => inspection.items)
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;

  @Column({ name: 'checklist_item_id' })
  checklistItemId: string;

  @ManyToOne(() => ChecklistItem)
  @JoinColumn({ name: 'checklist_item_id' })
  checklistItem: ChecklistItem;

  @Column({
    type: 'enum',
    enum: ChecklistAnswer,
    nullable: true,
  })
  answer: ChecklistAnswer;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_user_id', nullable: true })
  resolvedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedBy: User | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'resolution_evidence_path', nullable: true })
  resolutionEvidencePath: string | null;

  @OneToMany(() => Evidence, (evidence) => evidence.inspectionItem)
  evidences: Evidence[];
}
