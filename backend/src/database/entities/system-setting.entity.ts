import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_setting')
export class SystemSetting {
  @PrimaryColumn({ default: 1 })
  id!: number;

  @Column({ name: 'shipping_fee', type: 'int', default: 150000 })
  shippingFee!: number;

  @Column({ name: 'free_ship_from', type: 'int', default: 5000000 })
  freeShipFrom!: number;

  @Column({ name: 'delivery_day_start', length: 10, default: '08:00' })
  deliveryDayStart!: string;

  @Column({ name: 'delivery_day_end', length: 10, default: '18:00' })
  deliveryDayEnd!: string;

  @Column({ name: 'avg_speed_kmh', type: 'decimal', precision: 5, scale: 2, default: 30.00 })
  avgSpeedKmh!: string;

  @Column({ name: 'road_factor', type: 'decimal', precision: 4, scale: 2, default: 1.35 })
  roadFactor!: string;

  @Column({ name: 'weight_km', type: 'decimal', precision: 4, scale: 2, default: 1.00 })
  weightKm!: string;

  @Column({ name: 'weight_time', type: 'decimal', precision: 4, scale: 2, default: 0.50 })
  weightTime!: string;

  @Column({ name: 'bank_name', length: 120, nullable: true })
  bankName!: string | null;

  @Column({ name: 'bank_account_name', length: 120, nullable: true })
  bankAccountName!: string | null;

  @Column({ name: 'bank_account_number', length: 60, nullable: true })
  bankAccountNumber!: string | null;

  @Column({ name: 'bank_transfer_prefix', length: 60, default: 'THONGVAN' })
  bankTransferPrefix!: string;

  @Column({ name: 'warranty_contact', length: 255, nullable: true })
  warrantyContact!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
