import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Inspection } from './inspection.entity';

@Entity('signatures')
export class Signature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inspection_id' })
  inspectionId: string;

  @ManyToOne(() => Inspection, (inspection) => inspection.signatures)
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;

  @Column({ name: 'signer_name' })
  signerName: string;

  @Column({ name: 'signer_role_label', default: 'Lider/Encarregado' })
  signerRoleLabel: string;

  @Column({ name: 'image_path' })
  imagePath: string;

  @Column({ name: 'cloudinary_public_id', nullable: true })
  cloudinaryPublicId: string;

  @Column({ nullable: true })
  url: string;

  @Column({ name: 'signed_at' })
  signedAt: Date;
}
