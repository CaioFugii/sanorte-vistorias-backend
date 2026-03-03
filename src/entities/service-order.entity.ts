import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('service_orders')
export class ServiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'os_number', unique: true })
  osNumber: string;

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
