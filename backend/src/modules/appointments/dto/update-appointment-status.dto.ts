import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export type AppointmentStatus =
  'scheduled' | 'completed' | 'cancelled' | 'no_show';

export class UpdateAppointmentStatusDto {
  @IsIn(['scheduled', 'completed', 'cancelled', 'no_show'])
  status: AppointmentStatus;

  @ValidateIf((dto: UpdateAppointmentStatusDto) =>
    ['cancelled', 'no_show'].includes(dto.status),
  )
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  statusNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}
