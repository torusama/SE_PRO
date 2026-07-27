import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdminZoneDto {
  @IsString()
  @MaxLength(10)
  code!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  mapWidth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  mapHeight?: number;

  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateAdminZoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  mapWidth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  mapHeight?: number;

  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
