import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('product')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 40, nullable: true, unique: true })
  sku!: string | null;

  @Column({ length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand!: string | null;

  @Column({ length: 60 })
  category!: string;

  @Column({ type: 'decimal', precision: 12, scale: 0 })
  price!: string;

  @Column({ name: 'cost_price', type: 'decimal', precision: 12, scale: 0, nullable: true })
  costPrice!: string | null;

  @Column({ name: 'old_price', type: 'decimal', precision: 12, scale: 0, nullable: true })
  oldPrice!: string | null;

  @Column({ name: 'volume_m3', type: 'decimal', precision: 6, scale: 3 })
  volumeM3!: string;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 7, scale: 2 })
  weightKg!: string;

  @Column({ name: 'install_minutes', type: 'int' })
  installMinutes!: number;

  @Column({ type: 'json', nullable: true })
  images!: { imageUrl: string; imagePublicId: string | null }[] | null;

  @Column({ name: 'image_url', type: 'varchar', length: 1000, nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'image_public_id', type: 'varchar', length: 255, nullable: true })
  imagePublicId!: string | null;

  @Column({ name: 'warranty_months', type: 'int', default: 12 })
  warrantyMonths!: number;

  @Column({ name: 'maintenance_interval_months', type: 'int', nullable: true })
  maintenanceIntervalMonths!: number | null;

  @Column({ type: 'int', default: 10 })
  stock!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems!: OrderItem[];
}
