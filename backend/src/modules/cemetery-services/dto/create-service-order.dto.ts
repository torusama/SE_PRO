import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateServiceOrderDto {
  @IsNumber()
  serviceTypeId: number;

  @IsOptional()
  @IsNumber()
  plotId?: number;

  @IsOptional()
  @IsString()
  requestedDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
