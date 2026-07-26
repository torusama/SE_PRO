import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { ReminderType } from './create-reminder.dto';

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  title?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  remindMonth?: number;

  @IsOptional()
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

  @IsOptional()
  @IsString()
  specificDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  notifyDaysBefore?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique((email: string) => email.toLowerCase(), { message: 'Vui lòng chọn email khác, email đã bị trùng.' })
  @IsEmail({}, { each: true, message: 'Email không hợp lệ hoặc bị trùng.' })
  notifyEmails?: string[];
}