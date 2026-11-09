import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsUUID,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../database/entities';

export enum PaymentMethod {
  COD = 'COD',
  PAYOS = 'PAYOS',
  BANK_TRANSFER = 'BANK_TRANSFER',
  COUNTER_CASH = 'COUNTER_CASH',
}

export enum DeliveryType {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
}

export class OrderItemInDto {
  @IsInt()
  @Min(1)
  product_id!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity = 1;
}

export class CreateOrderDto {
  @IsOptional()
  @IsEnum(DeliveryType)
  delivery_type?: DeliveryType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customer_name!: string;

  @IsString()
  @Matches(/^0\d{9,10}$/)
  phone!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipient_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^0\d{9,10}$/)
  recipient_phone?: string;

  @IsOptional()
  @IsBoolean()
  is_gift = false;

  @IsOptional()
  @IsUUID()
  client_request_id?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsBoolean()
  save_address?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  address_label?: string;

  @IsOptional()
  @IsBoolean()
  set_default?: boolean;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsDateString()
  delivery_date!: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  time_window_start = '08:00';

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  time_window_end = '18:00';

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod = PaymentMethod.COD;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInDto)
  @ArrayMinSize(1)
  items!: OrderItemInDto[];
}

export class ShippingQuoteDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsEnum(DeliveryType)
  delivery_type?: DeliveryType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInDto)
  items!: OrderItemInDto[];
}

export class StatusUpdateDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class RequestInfoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  message!: string;
}

export class PriorityUpdateDto {
  @IsBoolean()
  is_urgent!: boolean;
}

export class LocationUpdateDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address?: string;
}

export class PaymentUpdateDto {
  @IsIn(['PAID'])
  status!: 'PAID';
}
