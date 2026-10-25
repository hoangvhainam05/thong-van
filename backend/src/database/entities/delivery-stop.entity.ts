import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { DeliveryRoute } from './route.entity';

@Entity('delivery_stop')
export class DeliveryStop {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'route_id' })
  routeId!: number;

  @ManyToOne(() => DeliveryRoute, (route) => route.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route!: DeliveryRoute;

  @Column({ name: 'order_id', unique: true })
  orderId!: number;

  @OneToOne(() => Order, (order) => order.stop, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'int' })
  sequence!: number;

  @Column({ name: 'eta_start', type: 'datetime' })
  etaStart!: Date;

  @Column({ name: 'eta_end', type: 'datetime' })
  etaEnd!: Date;

  @Column({ name: 'planned_arrival', type: 'datetime' })
  plannedArrival!: Date;

  @Column({ name: 'actual_arrival', type: 'datetime', nullable: true })
  actualArrival!: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt!: Date | null;
}
