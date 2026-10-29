import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
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

  @Column({ name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => Order, (order) => order.stops, { nullable: false })
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

  @Column({ type: 'enum', enum: ['DELIVERED', 'FAILED'], nullable: true })
  result!: 'DELIVERED' | 'FAILED' | null;

  @Column({ name: 'result_note', type: 'varchar', length: 255, nullable: true })
  resultNote!: string | null;

  @Column({ name: 'cod_collected', type: 'decimal', precision: 14, scale: 0, default: 0 })
  codCollected!: string;

  @Column({ name: 'proof_public_id', type: 'varchar', length: 255, nullable: true, select: false })
  proofPublicId!: string | null;

  @Column({ name: 'proof_format', type: 'varchar', length: 10, nullable: true, select: false })
  proofFormat!: string | null;

  @Column({ name: 'proof_uploaded_by', type: 'int', nullable: true })
  proofUploadedBy!: number | null;

  @Column({ name: 'proof_uploaded_at', type: 'datetime', nullable: true })
  proofUploadedAt!: Date | null;

  @Column({ name: 'active_order_id', type: 'int', nullable: true, asExpression: 'IF(completed_at IS NULL, order_id, NULL)', generatedType: 'STORED', insert: false, update: false, select: false })
  activeOrderId!: number | null;
}
