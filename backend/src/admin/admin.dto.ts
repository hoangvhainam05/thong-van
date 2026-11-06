import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ShippingVolumeTierDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) @Max(1000)
  max_m3?: number | null;

  @Type(() => Number) @IsInt() @Min(0) @Max(100000000)
  fee!: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  shipping_fee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  free_ship_from?: number;

  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  express_cutoff_time?: string;

  @IsOptional() @IsInt() @Min(1) @Max(1440)
  express_max_minutes?: number;

  @IsOptional() @IsNumber() @Min(0.1) @Max(500)
  express_max_distance_km?: number;

  @IsOptional() @IsNumber() @Min(0.001) @Max(1000)
  express_max_volume_m3?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.001) @Max(999999)
  express_max_weight_kg?: number | null;

  @IsOptional() @IsNumber() @Min(0.1) @Max(500)
  shipping_base_distance_km?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  shipping_base_fee?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  shipping_per_km_fee?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(500)
  shipping_free_distance_km?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) @Max(500)
  shipping_first_band_end_km?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000)
  shipping_first_band_fee?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) @Max(500)
  shipping_distance_step_km?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000)
  shipping_distance_step_fee?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  shipping_express_fee?: number;

  @IsOptional() @IsInt() @Min(1) @Max(10000000)
  shipping_rounding_increment?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ShippingVolumeTierDto)
  shipping_volume_tiers?: ShippingVolumeTierDto[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000)
  shipping_weight_fee_per_kg?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  shipping_additional_delay_minutes?: number;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  shipping_preparation_minutes?: number;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  shipping_handover_minutes?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(120)
  shipping_fallback_speed_kmh?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ bắt đầu phải có định dạng HH:mm (ví dụ 08:00)' })
  delivery_day_start?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ kết thúc phải có định dạng HH:mm (ví dụ 18:00)' })
  delivery_day_end?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  avg_speed_kmh?: number;

  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(3.0)
  road_factor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight_km?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight_time?: number;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  bank_account_name?: string;

  @IsOptional()
  @IsString()
  bank_account_number?: string;

  @IsOptional()
  @IsString()
  bank_transfer_prefix?: string;

  @IsOptional()
  @IsString()
  warranty_contact?: string;
}
