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
  @IsString({ message: 'Họ và tên không hợp lệ.' })
  @MaxLength(100, { message: 'Họ và tên tối đa 100 ký tự.' })
  fullName?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày sinh không hợp lệ.' })
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'], {
    message: 'Vui lòng chọn giới tính hợp lệ.',
  })
  gender?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ (số nhà, tên đường) không hợp lệ.' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại không hợp lệ.' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự.' })
  phone?: string;

  // --- Địa chỉ mở rộng ---
  @IsOptional()
  @IsString({ message: 'Quốc tịch không hợp lệ.' })
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @IsString({ message: 'Tỉnh/Thành phố không hợp lệ.' })
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString({ message: 'Xã/Phường không hợp lệ.' })
  @MaxLength(150)
  ward?: string;

  @IsOptional()
  @IsString({ message: 'Mã bưu điện không hợp lệ.' })
  @MaxLength(20)
  postalCode?: string;

  // --- Liên hệ khẩn cấp ---
  @IsOptional()
  @IsString({ message: 'Tên người liên hệ khẩn cấp không hợp lệ.' })
  @MaxLength(100)
  emergencyContactName?: string;

  @IsOptional()
  @IsString({ message: 'Mối quan hệ với người liên hệ khẩn cấp không hợp lệ.' })
  @MaxLength(50)
  emergencyContactRelation?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại người liên hệ khẩn cấp không hợp lệ.' })
  @MaxLength(20)
  emergencyContactPhone?: string;

  @IsOptional()
  @IsEmail(
    {},
    { message: 'Email người liên hệ khẩn cấp không đúng định dạng.' },
  )
  emergencyContactEmail?: string;

  // --- Ghi chú đặc biệt ---
  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ.' })
  @MaxLength(2000, { message: 'Ghi chú tối đa 2000 ký tự.' })
  notes?: string;

  // --- Tuỳ chọn nhận thông báo ---
  @IsOptional()
  @IsBoolean({ message: 'Tuỳ chọn nhận thông báo thanh toán không hợp lệ.' })
  notifyPayment?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Tuỳ chọn nhận thông báo dịch vụ không hợp lệ.' })
  notifyService?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Tuỳ chọn nhận nhắc lịch ngày giỗ không hợp lệ.' })
  notifyAnniversary?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Tuỳ chọn nhận thông báo chung không hợp lệ.' })
  notifyAnnouncement?: boolean;
}
