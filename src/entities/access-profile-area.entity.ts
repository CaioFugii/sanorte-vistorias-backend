import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AccessArea } from '../common/enums';
import { AccessProfile } from './access-profile.entity';

@Entity('access_profile_areas')
export class AccessProfileArea {
  @PrimaryColumn({ name: 'access_profile_id', type: 'uuid' })
  accessProfileId: string;

  @PrimaryColumn({ type: 'varchar' })
  area: AccessArea;

  @ManyToOne(() => AccessProfile, (accessProfile) => accessProfile.areas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'access_profile_id' })
  accessProfile: AccessProfile;
}
