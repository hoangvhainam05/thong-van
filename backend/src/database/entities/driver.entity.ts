import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DeliveryRoute } from './route.entity';

@Entity('driver')
export class Driver {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 20 })
  phone!: string;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => DeliveryRoute, (route) => route.driver)
  routes!: DeliveryRoute[];
}
