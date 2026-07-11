import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export class BookAppointmentDto {
  @IsInt()
  hostUserId: number;

  // Optional: if booking directly off a published slot
  @IsOptional()
  @IsInt()
  slotId?: number;

  @IsDateString()
  appointmentDate: string;

  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @IsOptional()
  @IsString()
  note?: string;
}
