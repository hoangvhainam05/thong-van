import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DeliveryRoute } from './route.entity';
import { Driver } from './driver.entity';

@Entity('vehicle')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20, unique: true })
  plate!: string;

  @Column({ name: 'capacity_m3', type: 'decimal', precision: 6, scale: 2 })
  capacityM3!: string;

  @Column({ name: 'capacity_kg', type: 'decimal', precision: 8, scale: 2 })
  capacityKg!: string;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => DeliveryRoute, (route) => route.vehicle)
  routes!: DeliveryRoute[];

  @ManyToMany(() => Driver, (driver) => driver.vehicles)
  @JoinTable({
    name: 'vehicle_driver',
    joinColumn: { name: 'vehicle_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'driver_id', referencedColumnName: 'id' },
  })
  drivers!: Driver[];
}
