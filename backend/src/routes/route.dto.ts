import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsInt,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  ArrayUnique,
  Min,
  Matches,
  IsNumber,
  ArrayNotEmpty,
} from 'class-validator';
import { DeliveryShift } from '../database/entities/enums';

export class OptimizeRequestDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsIn([DeliveryShift.MORNING, DeliveryShift.AFTERNOON])
  shift!: DeliveryShift;

  @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  vehicle_ids?: number[];

  @IsOptional() @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  order_ids?: number[];
}

export class DraftRouteUpdateDto {
  @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  order_ids?: number[];

  @IsOptional() @IsInt() @Min(1)
  vehicle_id?: number;

  @IsOptional() @IsInt() @Min(1)
  driver_id?: number | null;
}

export class StopCompleteDto {
  @IsOptional()
  @IsBoolean()
  success = true;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 0 }) @Min(0)
  cod_collected?: number;
}

export class RescheduleDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString()
  delivery_date!: string;
}

export class RouteQueryDto {
  @IsDateString()
  route_date!: string;

  @IsOptional()
  @IsInt()
  driver_id?: number;
}
