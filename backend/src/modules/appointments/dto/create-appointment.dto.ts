import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  @Min(1)
  reservationRequestId: number;

  @IsDateString()
  scheduledAt: string;

  @IsDateString()
  scheduledEndAt: string;

  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedStaffId?: number;

  @ValidateIf((dto: CreateAppointmentDto) => !dto.assignedStaffId)
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  assignedStaffName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}
