import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ModuleType, InspectionStatus } from '../common/enums';
import { Checklist } from './checklist.entity';
import { Team } from './team.entity';
import { User } from './user.entity';
import { Collaborator } from './collaborator.entity';
import { InspectionItem } from './inspection-item.entity';
import { Evidence } from './evidence.entity';
import { Signature } from './signature.entity';
import { PendingAdjustment } from './pending-adjustment.entity';

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ModuleType,
  })
  module: ModuleType;

  @Column({ name: 'checklist_id' })
  checklistId: string;

  @ManyToOne(() => Checklist)
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

  @Column({ name: 'team_id' })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'service_description', type: 'text' })
  serviceDescription: string;

  @Column({ name: 'location_description', type: 'text', nullable: true })
  locationDescription: string;

  @Column({
    type: 'enum',
    enum: InspectionStatus,
    default: InspectionStatus.RASCUNHO,
  })
  status: InspectionStatus;

  @Column({
    name: 'score_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  scorePercent: number;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @Column({ name: 'finalized_at', nullable: true })
  finalizedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => Collaborator, (collaborator) => collaborator.inspections)
  @JoinTable({
    name: 'inspection_collaborators',
    joinColumn: { name: 'inspection_id' },
    inverseJoinColumn: { name: 'collaborator_id' },
  })
  collaborators: Collaborator[];

  @OneToMany(() => InspectionItem, (item) => item.inspection)
  items: InspectionItem[];

  @OneToMany(() => Evidence, (evidence) => evidence.inspection)
  evidences: Evidence[];

  @OneToMany(() => Signature, (signature) => signature.inspection)
  signatures: Signature[];

  @OneToMany(() => PendingAdjustment, (pending) => pending.inspection)
  pendingAdjustments: PendingAdjustment[];
}
