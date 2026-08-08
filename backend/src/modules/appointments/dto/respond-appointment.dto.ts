import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class RespondAppointmentDto {
  @IsIn(['confirmed', 'declined'])
  status: 'confirmed' | 'declined';

  @ValidateIf((dto: RespondAppointmentDto) => dto.status === 'confirmed')
  @IsDateString()
  selectedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
}
