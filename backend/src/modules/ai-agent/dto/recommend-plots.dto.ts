import { Type } from 'class-transformer';
import {
  IsArray,
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  recommendationCount?: number;

  @IsOptional()
  @IsBoolean()
  comparisonRequested?: boolean;

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
  @IsBoolean()
  preferNearEntrance?: boolean;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  excludePlotIds?: number[];

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthTime?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: 'male' | 'female' | 'other';
}
