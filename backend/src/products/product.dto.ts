import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ProductImageDto {
  @IsString() @MinLength(1) @MaxLength(1000) imageUrl!: string;
  @IsOptional() @IsString() @MaxLength(255) imagePublicId?: string | null;
}

export class CreateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sku?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  oldPrice?: number | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999.999)
  volume!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  install!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1200)
  warranty?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120)
  maintenanceIntervalMonths?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagePublicId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class SetProductVisibilityDto {
  @IsBoolean()
  active!: boolean;
}
