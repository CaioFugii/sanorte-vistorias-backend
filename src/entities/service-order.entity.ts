import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Sector } from './sector.entity';
import { Contract } from './contract.entity';

@Entity('service_orders')
@Unique('UQ_os_number_sector_id', ['osNumber', 'sectorId'])
export class ServiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'os_number' })
  osNumber: string;

  @Column({ name: 'sector_id' })
  sectorId: string;

  @ManyToOne(() => Sector, (sector) => sector.serviceOrders)
  @JoinColumn({ name: 'sector_id' })
  sector: Sector;

  @Column({ name: 'contract_id', nullable: true })
  contractId: string | null;

  @ManyToOne(() => Contract, (contract) => contract.serviceOrders, {
    nullable: true,
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract | null;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'boolean', default: false })
  field: boolean;

  @Column({ type: 'boolean', default: false })
  remote: boolean;

  @Column({ name: 'post_work', type: 'boolean', default: false })
  postWork: boolean;

  @Column({ type: 'text', nullable: true })
  resultado: string | null;

  @Column({ name: 'fim_execucao', type: 'timestamp', nullable: true })
  fimExecucao: Date | null;

  @Column({ name: 'tempo_execucao_efetivo', type: 'text', nullable: true })
  tempoExecucaoEfetivo: string | null;

  @Column({
    name: 'tempo_execucao_efetivo_segundos',
    type: 'integer',
    nullable: true,
  })
  tempoExecucaoEfetivoSegundos: number | null;

  @Column({ type: 'text', nullable: true })
  equipe: string | null;

  @Column({ type: 'text', nullable: true })
  familia: string | null;

  @Column({ type: 'text', nullable: true })
  status: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
