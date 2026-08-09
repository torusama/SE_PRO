import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ComparisonOptionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  plotIds!: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  plotCodes!: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  score!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedTotal!: number;

  @IsString()
  @MaxLength(120)
  zoneName!: string;

  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  directions!: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAreaSqm!: number;

  @IsBoolean()
  isAdjacent!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  accessSummary?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  reasons?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  tradeOffs?: string[];
}

export class ComparisonDecisionContextDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  numberOfPlots?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredDirection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plotType?: string;

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
}

export class CompareRecommendationsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ComparisonOptionDto)
  options!: ComparisonOptionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ComparisonDecisionContextDto)
  context?: ComparisonDecisionContextDto;
}
