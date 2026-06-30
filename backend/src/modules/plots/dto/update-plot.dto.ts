import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdatePlotDto {
  @IsOptional()
  @IsString()
  plotCode?: string;

  @IsOptional()
  @IsNumber()
  zoneId?: number;

  @IsOptional()
  @IsString()
  rowNumber?: string;

  @IsOptional()
  @IsString()
  columnNumber?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  area?: number;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsIn(['single', 'double', 'family'])
  plotType?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePlotStatusDto {
  @IsIn(['available', 'pending', 'reserved', 'sold', 'locked'])
  status: string;
}
