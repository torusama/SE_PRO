import {
  IsBoolean,
  IsDateString,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export class CreateAvailabilitySlotDto {
  @IsBoolean()
  isRecurring: boolean;

  // Required when isRecurring = true (0 = Sunday ... 6 = Saturday)
  @ValidateIf((dto) => dto.isRecurring === true)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  // Required when isRecurring = false
  @ValidateIf((dto) => dto.isRecurring === false)
  @IsDateString()
  specificDate?: string;

  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime: string;
}
