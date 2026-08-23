import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeceasedProfileDto {
  // Bắt buộc trừ khi isExternalPlot=true (hồ sơ cho người thân an táng ở
  // lô đất ngoài nghĩa trang, không gắn với lô nào hệ thống đang quản lý).
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) plotId?: number;
  @IsOptional() @IsBoolean() isExternalPlot?: boolean;
  @IsOptional() @IsString() @MaxLength(255) externalPlotNote?: string;
  @IsString() @MaxLength(100) fullName: string;
  // Legacy: vẫn nhận nếu có (dữ liệu cũ / admin), nhưng form khách hàng mới
  // không còn gửi 2 trường này nữa — dùng birthDay/Month/Year và
  // anniversaryDay/Month/Year bên dưới thay thế.
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsDateString() dateOfDeath?: string;
  @IsOptional() @IsDateString() burialDate?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) hometown?: string;
  @IsOptional() @IsString() @MaxLength(10000) biography?: string;

  // Chế độ lịch áp dụng chung cho CẢ "Ngày sinh" lẫn "Ngày giỗ" của hồ sơ
  // này. 'solar' = lưu nguyên là ngày Dương lịch. 'lunar' = lưu nguyên
  // ngày/tháng/năm đã nhập nhưng hiểu là Âm lịch (không quy đổi lúc lưu).
  @IsOptional() @IsIn(['solar', 'lunar']) dateCalendarType?: 'solar' | 'lunar';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) birthDay?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  birthMonth?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  birthYear?: number;

  // "Ngày giỗ" — thay thế "Ngày mất"/"Ngày an táng" cũ, luôn lặp lại hàng
  // năm theo đúng ngày/tháng đã nhập (Dương hoặc Âm tuỳ dateCalendarType).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  anniversaryDay?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  anniversaryMonth?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  anniversaryYear?: number;
}
export class UpdateDeceasedProfileDto extends CreateDeceasedProfileDto {
  @IsOptional() declare plotId: number;
  @IsOptional() declare fullName: string;
}
export class DeceasedProfileQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() plotId?: number;
  @IsOptional() @Type(() => Number) @IsInt() familyId?: number;
  @IsOptional() @IsString() verificationStatus?: string;
  get offset() {
    return (this.page - 1) * this.pageSize;
  }
}
export class ConfigurePlotCapacityDto {
  @Type(() => Number) @IsInt() @Min(1) capacity: number;
}
