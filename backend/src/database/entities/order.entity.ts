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

  @Column({ name: 'time_window_end', type: 'time', default: '18:00:00' })
  timeWindowEnd!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  total!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  subtotal!: string;

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 12, scale: 0, default: 0 })
  shippingFee!: string;

  @Column({ name: 'total_shipping_fee', type: 'decimal', precision: 12, scale: 0, nullable: true })
  totalShippingFee!: string | null;

  @Column({ name: 'warehouse_id', type: 'int', nullable: true }) warehouseId!: number | null;
  @Column({ name: 'delivery_distance_km', type: 'decimal', precision: 9, scale: 3, nullable: true }) deliveryDistanceKm!: string | null;
  @Column({ name: 'delivery_type', type: 'enum', enum: ['STANDARD', 'EXPRESS'], default: 'STANDARD' }) deliveryType!: 'STANDARD' | 'EXPRESS';
  @Column({ name: 'length_cm', type: 'decimal', precision: 8, scale: 2, nullable: true }) packageLengthCm!: string | null;
  @Column({ name: 'width_cm', type: 'decimal', precision: 8, scale: 2, nullable: true }) packageWidthCm!: string | null;
  @Column({ name: 'height_cm', type: 'decimal', precision: 8, scale: 2, nullable: true }) packageHeightCm!: string | null;
  @Column({ name: 'volume_m3', type: 'decimal', precision: 9, scale: 4, nullable: true }) volumeM3!: string | null;
  @Column({ name: 'weight_kg', type: 'decimal', precision: 9, scale: 3, nullable: true }) weightKg!: string | null;
  @Column({ name: 'package_count', type: 'int', nullable: true }) packageCount!: number | null;
  @Column({ name: 'package_details', type: 'json', nullable: true }) packageDetails!: Array<{ productId: number; lengthCm: number; widthCm: number; heightCm: number; weightKg: number; quantity: number }> | null;
  @Column({ name: 'preparation_minutes', type: 'int', nullable: true }) preparationMinutes!: number | null;
  @Column({ name: 'travel_minutes', type: 'int', nullable: true }) travelMinutes!: number | null;
  @Column({ name: 'estimated_delivery_minutes', type: 'int', nullable: true }) estimatedDeliveryMinutes!: number | null;
  @Column({ name: 'estimated_arrival_at', type: 'datetime', nullable: true }) estimatedArrivalAt!: Date | null;
  @Column({ name: 'distance_fee', type: 'int', nullable: true }) distanceFee!: number | null;
  @Column({ name: 'volume_fee', type: 'int', nullable: true }) volumeFee!: number | null;
  @Column({ name: 'weight_fee', type: 'int', nullable: true }) weightFee!: number | null;
  @Column({ name: 'express_fee', type: 'int', nullable: true }) expressFee!: number | null;
  @Column({ name: 'shipping_discount', type: 'int', nullable: true }) shippingDiscount!: number | null;
  @Column({ name: 'shipping_rate_version', type: 'int', nullable: true }) shippingRateVersion!: number | null;

  @Column({ name: 'client_request_id', type: 'varchar', length: 64, nullable: true, unique: true })
  clientRequestId!: string | null;

  @Column({ type: 'enum', enum: ['WEB', 'COUNTER'], default: 'WEB' })
  source!: 'WEB' | 'COUNTER';

  @Column({ name: 'payment_method', type: 'enum', enum: ['COD', 'BANK_TRANSFER', 'COUNTER_CASH', 'PAYOS'], default: 'COD' })
  paymentMethod!: 'COD' | 'BANK_TRANSFER' | 'COUNTER_CASH' | 'PAYOS';

  @Column({ name: 'payos_order_code', type: 'varchar', length: 20, nullable: true, unique: true }) payosOrderCode!: string | null;
  @Column({ name: 'payos_link_id', type: 'varchar', length: 100, nullable: true }) payosLinkId!: string | null;
  @Column({ name: 'payos_checkout_url', type: 'varchar', length: 500, nullable: true }) payosCheckoutUrl!: string | null;

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
