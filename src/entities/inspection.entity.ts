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
import { ModuleType, InspectionStatus, InspectionScope } from '../common/enums';
import { Checklist } from './checklist.entity';
import { Team } from './team.entity';
import { User } from './user.entity';
import { Collaborator } from './collaborator.entity';
import { InspectionItem } from './inspection-item.entity';
import { Evidence } from './evidence.entity';
import { Signature } from './signature.entity';
import { PendingAdjustment } from './pending-adjustment.entity';
import { ServiceOrder } from './service-order.entity';

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ModuleType,
  })
  module: ModuleType;

  @Column({
    name: 'inspection_scope',
    type: 'enum',
    enum: InspectionScope,
    default: InspectionScope.TEAM,
  })
  inspectionScope: InspectionScope;

  @Column({ name: 'checklist_id' })
  checklistId: string;

  @ManyToOne(() => Checklist)
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

  @Column({ name: 'team_id', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ name: 'service_description', type: 'text', nullable: true })
  serviceDescription: string | null;

  @Column({ name: 'service_order_id', nullable: true })
  serviceOrderId: string | null;

  @ManyToOne(() => ServiceOrder, { nullable: true })
  @JoinColumn({ name: 'service_order_id' })
  serviceOrder: ServiceOrder | null;

  @Column({ name: 'external_id', type: 'uuid', nullable: true, unique: true })
  externalId: string | null;

  @Column({ name: 'created_offline', default: false })
  createdOffline: boolean;

  @Column({ name: 'synced_at', nullable: true })
  syncedAt: Date | null;

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

  @Column({ name: 'has_paralysis_penalty', default: false })
  hasParalysisPenalty: boolean;

  @Column({ name: 'paralyzed_reason', type: 'text', nullable: true })
  paralyzedReason: string | null;

  @Column({ name: 'paralyzed_at', nullable: true })
  paralyzedAt: Date | null;

  @Column({ name: 'paralyzed_by_user_id', nullable: true })
  paralyzedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'paralyzed_by_user_id' })
  paralyzedBy: User | null;

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
