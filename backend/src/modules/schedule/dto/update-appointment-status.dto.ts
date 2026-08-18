import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentStatusDto {
  @IsIn(['confirmed', 'cancelled', 'completed'])
  status: 'confirmed' | 'cancelled' | 'completed';

  @IsOptional()
  @IsString()
  note?: string;
}
