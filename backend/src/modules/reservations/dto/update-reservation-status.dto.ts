import { IsOptional, IsString } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsOptional()
  @IsString()
  adminNote?: string;
}
