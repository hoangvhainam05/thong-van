import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

export enum OrderHistoryEventType {
  STATUS = 'STATUS',
  PAYMENT = 'PAYMENT',
  INFO_REQUEST = 'INFO_REQUEST',
  LOCATION = 'LOCATION',
}

@Entity('order_history')
export class OrderHistoryEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => Order, (order) => order.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'event_type', type: 'enum', enum: OrderHistoryEventType })
  eventType!: OrderHistoryEventType;

  @Column({ name: 'from_value', type: 'varchar', length: 30, nullable: true })
  fromValue!: string | null;

  @Column({ name: 'to_value', type: 'varchar', length: 30, nullable: true })
  toValue!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 40, default: 'SYSTEM' })
  actor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
