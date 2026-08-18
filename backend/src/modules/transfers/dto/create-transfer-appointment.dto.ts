import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTransferAppointmentDto {
  @IsDateString()
  rangeStart!: string;

  @IsDateString()
  rangeEnd!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
