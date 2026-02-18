import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Inspection } from './inspection.entity';
import { InspectionItem } from './inspection-item.entity';
import { User } from './user.entity';

@Entity('evidences')
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inspection_id' })
  inspectionId: string;

  @ManyToOne(() => Inspection, (inspection) => inspection.evidences)
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;

  @Column({ name: 'inspection_item_id', nullable: true })
  inspectionItemId: string;

  @ManyToOne(() => InspectionItem, (item) => item.evidences, { nullable: true })
  @JoinColumn({ name: 'inspection_item_id' })
  inspectionItem: InspectionItem;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column()
  size: number;

  @Column({ name: 'cloudinary_public_id', nullable: true })
  cloudinaryPublicId: string;

  @Column({ nullable: true })
  url: string;

  @Column({ nullable: true })
  bytes: number;

  @Column({ nullable: true })
  format: string;

  @Column({ nullable: true })
  width: number;

  @Column({ nullable: true })
  height: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'uploaded_by_user_id' })
  uploadedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: User;
}
