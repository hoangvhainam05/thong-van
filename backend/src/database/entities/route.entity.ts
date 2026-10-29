import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryStop } from './delivery-stop.entity';
import { Driver } from './driver.entity';
import { RouteStatus } from './enums';
import { Vehicle } from './vehicle.entity';
import { Warehouse } from './warehouse.entity';

@Entity('route')
export class DeliveryRoute {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'route_date', type: 'date' })
  routeDate!: string;

  @Column({ name: 'warehouse_id' })
  warehouseId!: number;

  @ManyToOne(() => Warehouse, { nullable: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Column({ name: 'driver_id', type: 'int', nullable: true })
  driverId!: number | null;

  @ManyToOne(() => Driver, (driver) => driver.routes, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver | null;

  @Column({ name: 'vehicle_id' })
  vehicleId!: number;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.routes, { nullable: false })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @Column({ type: 'enum', enum: RouteStatus, default: RouteStatus.DRAFT })
  status!: RouteStatus;

  @Column({ name: 'total_km', type: 'decimal', precision: 8, scale: 2, default: 0 })
  totalKm!: string;

  @Column({ name: 'total_minutes', type: 'int', default: 0 })
  totalMinutes!: number;

  @Column({ name: 'baseline_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  baselineKm!: string | null;

  @Column({ name: 'routing_matrix', type: 'json', nullable: true })
  routingMatrix!: { source: 'ors' | 'estimate'; orderIds: number[]; points: [number, number][]; km: number[][]; minutes: number[][] } | null;

  @Column({ length: 30, default: 'heuristic' })
  solver!: string;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => DeliveryStop, (stop) => stop.route, { cascade: true })
  stops!: DeliveryStop[];
}
