import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateServiceOrderDto {
  @IsNumber()
  serviceTypeId: number;

  @IsOptional()
  @IsNumber()
  plotId?: number;

  @IsOptional()
  @IsNumber()
  deceasedProfileId?: number;

  @IsOptional()
  @IsDateString()
  requestedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
