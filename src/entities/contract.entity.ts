import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { City } from './city.entity';
import { User } from './user.entity';
import { ServiceOrder } from './service-order.entity';
import { Team } from './team.entity';

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

  @ManyToMany(() => City, (city) => city.contracts)
  @JoinTable({
    name: 'contract_cities',
    joinColumn: { name: 'contract_id' },
    inverseJoinColumn: { name: 'city_id' },
  })
  cities: City[];

  @ManyToMany(() => User, (user) => user.contracts)
  users: User[];

  @OneToMany(() => ServiceOrder, (serviceOrder) => serviceOrder.contract)
  serviceOrders: ServiceOrder[];

  @ManyToMany(() => Team, (team) => team.contracts)
  teams: Team[];
}
