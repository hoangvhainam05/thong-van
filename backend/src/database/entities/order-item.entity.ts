import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from './product.entity';

@Entity('order_item')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product, (product) => product.orderItems, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 0 })
  unitPrice!: string;

  @Column({ name: 'warranty_months_snapshot', type: 'int', nullable: true })
  warrantyMonthsSnapshot!: number | null;

  @Column({ name: 'maintenance_interval_months_snapshot', type: 'int', nullable: true })
  maintenanceIntervalMonthsSnapshot!: number | null;
}
