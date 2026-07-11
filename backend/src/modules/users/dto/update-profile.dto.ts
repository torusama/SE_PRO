import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  // --- Địa chỉ mở rộng ---
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  // --- Liên hệ khẩn cấp ---
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactRelation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;

  @IsOptional()
  @IsEmail()
  emergencyContactEmail?: string;

  // --- Ghi chú đặc biệt ---
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // --- Tuỳ chọn nhận thông báo ---
  @IsOptional()
  @IsBoolean()
  notifyPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyService?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyAnniversary?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyAnnouncement?: boolean;
}
