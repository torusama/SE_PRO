import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  adminNote?: string;
}
