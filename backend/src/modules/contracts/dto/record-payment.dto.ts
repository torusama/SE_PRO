import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsIn(['cash', 'bank_transfer', 'card', 'other'])
  paymentMethod = 'cash';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
