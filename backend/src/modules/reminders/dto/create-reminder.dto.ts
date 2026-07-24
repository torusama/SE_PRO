import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export type ReminderType =
  | 'death_anniversary'
  | 'memorial'
  | 'maintenance'
  | 'other';

export class CreateReminderDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  plotId?: number;

  @IsOptional()
  @IsInt()
  ownershipId?: number;

  @IsOptional()
  @IsIn(['death_anniversary', 'memorial', 'maintenance', 'other'])
  reminderType?: ReminderType;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  // Bắt buộc khi isRecurring = true (mặc định true)
  @ValidateIf((dto) => dto.isRecurring !== false)
  @IsInt()
  @Min(1)
  @Max(12)
  remindMonth?: number;

  @ValidateIf((dto) => dto.isRecurring !== false)
  @IsInt()
  @Min(1)
  @Max(31)
  remindDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(13)
  lunarMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  lunarDay?: number;

  @IsOptional()
  @IsBoolean()
  isLeapMonth?: boolean;

  // Bắt buộc khi isRecurring = false (nhắc 1 lần, ngày cụ thể)
  @ValidateIf((dto) => dto.isRecurring === false)
  @IsString()
  specificDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  notifyDaysBefore?: number;
}
