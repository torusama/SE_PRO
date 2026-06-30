import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

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
  @IsString()
  direction?: string;

  @IsOptional()
  @IsIn(['single', 'double', 'family'])
  plotType?: string;
}
