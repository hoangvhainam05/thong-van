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

  @Column({ name: 'express_cutoff_time', length: 5, default: '16:00' }) expressCutoffTime!: string;
  @Column({ name: 'express_max_minutes', type: 'int', default: 300 }) expressMaxMinutes!: number;
  @Column({ name: 'express_max_distance_km', type: 'decimal', precision: 7, scale: 2, default: 10 }) expressMaxDistanceKm!: string;
  @Column({ name: 'express_max_volume_m3', type: 'decimal', precision: 7, scale: 4, default: 0.1 }) expressMaxVolumeM3!: string;
  @Column({ name: 'express_max_weight_kg', type: 'decimal', precision: 8, scale: 3, nullable: true }) expressMaxWeightKg!: string | null;
  @Column({ name: 'shipping_base_distance_km', type: 'decimal', precision: 7, scale: 2, default: 2 }) shippingBaseDistanceKm!: string;
  @Column({ name: 'shipping_base_fee', type: 'int', default: 15000 }) shippingBaseFee!: number;
  @Column({ name: 'shipping_per_km_fee', type: 'int', default: 5000 }) shippingPerKmFee!: number;
  @Column({ name: 'shipping_express_fee', type: 'int', default: 10000 }) shippingExpressFee!: number;
  @Column({ name: 'shipping_rounding_increment', type: 'int', default: 1000 }) shippingRoundingIncrement!: number;
  @Column({ name: 'shipping_volume_tiers', type: 'json', nullable: true }) shippingVolumeTiers!: Array<{ max_m3: number | null; fee: number }> | null;
  @Column({ name: 'shipping_weight_fee_per_kg', type: 'int', nullable: true }) shippingWeightFeePerKg!: number | null;
  @Column({ name: 'shipping_additional_delay_minutes', type: 'int', default: 0 }) shippingAdditionalDelayMinutes!: number;
  @Column({ name: 'shipping_preparation_minutes', type: 'int', default: 10 }) shippingPreparationMinutes!: number;
  @Column({ name: 'shipping_handover_minutes', type: 'int', default: 5 }) shippingHandoverMinutes!: number;
  @Column({ name: 'shipping_fallback_speed_kmh', type: 'decimal', precision: 5, scale: 2, default: 25 }) shippingFallbackSpeedKmh!: string;
  @Column({ name: 'shipping_rate_version', type: 'int', default: 1 }) shippingRateVersion!: number;

  @Column({ name: 'avg_speed_kmh', type: 'decimal', precision: 5, scale: 2, default: 30.00 })
  avgSpeedKmh!: string;

  @Column({ name: 'road_factor', type: 'decimal', precision: 4, scale: 2, default: 1.35 })
  roadFactor!: string;

  @Column({ name: 'weight_km', type: 'decimal', precision: 4, scale: 2, default: 1.00 })
  weightKm!: string;

  @Column({ name: 'weight_time', type: 'decimal', precision: 4, scale: 2, default: 0.50 })
  weightTime!: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 120, nullable: true })
  bankName!: string | null;

  @Column({ name: 'bank_account_name', type: 'varchar', length: 120, nullable: true })
  bankAccountName!: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 60, nullable: true })
  bankAccountNumber!: string | null;

  @Column({ name: 'bank_transfer_prefix', length: 60, default: 'THONGVAN' })
  bankTransferPrefix!: string;

  @Column({ name: 'warranty_contact', type: 'varchar', length: 255, nullable: true })
  warrantyContact!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
