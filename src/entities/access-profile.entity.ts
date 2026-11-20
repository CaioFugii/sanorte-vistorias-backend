import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccessProfileArea } from './access-profile-area.entity';
import { User } from './user.entity';

@Entity('access_profiles')
export class AccessProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AccessProfileArea, (area) => area.accessProfile)
  areas: AccessProfileArea[];

  @OneToMany(() => User, (user) => user.accessProfile)
  users: User[];
}
