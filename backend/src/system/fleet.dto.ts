import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';

export class CreateDriverDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsString() @Matches(/^0\d{9,10}$/)
  phone!: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateDriverDto extends PartialType(CreateDriverDto) {}

export class CreateVehicleDto {
  @IsString() @MinLength(3) @MaxLength(20)
  plate!: string;

  @IsNumber() @Min(0.01) @Max(9999)
  capacity_m3!: number;

  @IsNumber() @Min(1) @Max(999999)
  capacity_kg!: number;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}

export class UpdateWarehouseDto {
  @IsString() @Matches(/\S/) @MaxLength(120)
  name!: string;

  @IsString() @Matches(/\S/) @MaxLength(255)
  address!: string;

  @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @IsNumber() @Min(-180) @Max(180)
  lng!: number;
}
