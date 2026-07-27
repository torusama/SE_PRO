import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecommendPlotsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budgetMax!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  numberOfPlots!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredDirection?: string;

  @IsOptional()
  @IsIn(['single', 'double', 'family'])
  plotType?: 'single' | 'double' | 'family';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAreaSqm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAreaSqm?: number;

  @IsOptional()
  @IsBoolean()
  needAdjacent?: boolean;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthTime?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: 'male' | 'female' | 'other';
}
