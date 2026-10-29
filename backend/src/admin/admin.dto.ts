import { IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping_fee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  free_ship_from?: number;

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
