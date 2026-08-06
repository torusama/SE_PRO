import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export const PLOT_DIRECTIONS = [
  'Đông',
  'Tây',
  'Nam',
  'Bắc',
  'Đông Bắc',
  'Đông Nam',
  'Tây Bắc',
  'Tây Nam',
];

export class CreatePlotDto {
  @IsString()
  plotCode: string;

  @IsNumber()
  zoneId: number;

  @IsOptional()
  @IsString()
  rowNumber?: string;

  @IsOptional()
  @IsString()
  columnNumber?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  area?: number;

  @IsOptional()
  @IsIn(PLOT_DIRECTIONS)
  direction?: string;

  @IsOptional()
  @IsIn(['single', 'double', 'family'])
  plotType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  mapX?: number;

  @IsOptional()
  @IsNumber()
  mapY?: number;

  @IsOptional()
  @IsNumber()
  mapWidth?: number;

  @IsOptional()
  @IsNumber()
  mapHeight?: number;
}
