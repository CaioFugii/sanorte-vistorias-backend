import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { PendingStatus } from '../common/enums';
import { Inspection } from './inspection.entity';
import { User } from './user.entity';

@Entity('pending_adjustments')
export class PendingAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inspection_id', unique: true })
  inspectionId: string;

  @OneToOne(() => Inspection, (inspection) => inspection.pendingAdjustments)
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;

  @Column({
    type: 'enum',
    enum: PendingStatus,
    default: PendingStatus.PENDENTE,
  })
  status: PendingStatus;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by_user_id', nullable: true })
  resolvedByUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedBy: User;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ name: 'resolution_evidence_path', nullable: true })
  resolutionEvidencePath: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
