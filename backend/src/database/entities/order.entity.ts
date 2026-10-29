import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { DeliveryStop } from './delivery-stop.entity';
import { OrderItem } from './order-item.entity';
import { OrderHistoryEvent } from './order-history.entity';
import { OrderStatus, PaymentStatus } from './enums';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  code!: string | null;

  @Column({ name: 'customer_id' })
  customerId!: number;

  @ManyToOne(() => Customer, (customer) => customer.orders, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'recipient_name', type: 'varchar', length: 120, nullable: true })
  recipientName!: string | null;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 20, nullable: true })
  recipientPhone!: string | null;

  @Column({ name: 'is_gift', type: 'boolean', default: false })
  isGift!: boolean;

  @Column({ name: 'is_urgent', type: 'boolean', default: false })
  isUrgent!: boolean;

  @Column({ length: 255 })
  address!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng!: string | null;

  @Column({ name: 'delivery_date', type: 'date' })
  deliveryDate!: string;

  @Column({ name: 'time_window_start', type: 'time', default: '08:00:00' })
  timeWindowStart!: string;

  @Column({ name: 'time_window_end', type: 'time', default: '17:00:00' })
  timeWindowEnd!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  total!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  subtotal!: string;

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 12, scale: 0, default: 0 })
  shippingFee!: string;

  @Column({ name: 'client_request_id', type: 'varchar', length: 64, nullable: true, unique: true })
  clientRequestId!: string | null;

  @Column({ type: 'enum', enum: ['WEB', 'COUNTER'], default: 'WEB' })
  source!: 'WEB' | 'COUNTER';

  @Column({ name: 'payment_method', type: 'enum', enum: ['COD', 'BANK_TRANSFER', 'COUNTER_CASH'], default: 'COD' })
  paymentMethod!: 'COD' | 'BANK_TRANSFER' | 'COUNTER_CASH';

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID })
  paymentStatus!: PaymentStatus;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @OneToMany(() => OrderHistoryEvent, (event) => event.order)
  history!: OrderHistoryEvent[];

  @OneToMany(() => DeliveryStop, (stop) => stop.order)
  stops!: DeliveryStop[];
}
