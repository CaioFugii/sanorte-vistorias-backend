import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { ServiceOrder } from './service-order.entity';
import { Team } from './team.entity';
import { Collaborator } from './collaborator.entity';
import { InvestmentWork } from './investment-work.entity';
import { Inspection } from './inspection.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(() => User, (user) => user.contracts)
  users: User[];

  @OneToMany(() => ServiceOrder, (serviceOrder) => serviceOrder.contract)
  serviceOrders: ServiceOrder[];

  @OneToMany(() => Collaborator, (collaborator) => collaborator.contract)
  collaborators: Collaborator[];

  @ManyToMany(() => Team, (team) => team.contracts)
  teams: Team[];

  @OneToMany(() => InvestmentWork, (investmentWork) => investmentWork.contract)
  investmentWorks: InvestmentWork[];

  @OneToMany(() => Inspection, (inspection) => inspection.contract)
  inspections: Inspection[];
}
