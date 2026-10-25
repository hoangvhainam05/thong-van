import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class OptimizeRequestDto {
  @IsDateString()
  date!: string;
}

export class StopCompleteDto {
  @IsOptional()
  @IsBoolean()
  success = true;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class RouteQueryDto {
  @IsDateString()
  route_date!: string;

  @IsOptional()
  @IsInt()
  driver_id?: number;
}
