import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sector } from './sector.entity';

@Entity('service_orders')
export class ServiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'os_number', unique: true })
  osNumber: string;

  @Column({ name: 'sector_id' })
  sectorId: string;

  @ManyToOne(() => Sector, (sector) => sector.serviceOrders)
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'boolean', default: false })
  field: boolean;

  @Column({ type: 'boolean', default: false })
  remote: boolean;

  @Column({ name: 'post_work', type: 'boolean', default: false })
  postWork: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
